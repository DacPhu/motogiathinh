"""
Migrate crawled data from old Halozend system into the new motogiathinh PostgreSQL database.

Prerequisites:
  - docker compose up -d (db running)
  - alembic upgrade head (tables exist)
  - crawling/data/ folder populated by crawl.py

Usage:
  python data-migration/migrate.py
"""

import asyncio
import os
import uuid
from datetime import date, datetime

import asyncpg

from helpers import (
    gender_map, infer_license_type, load_json, map_class_status,
    new_id, parse_date, parse_phone_contacts,
)

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://mgt:mgt_secret@localhost:5432/motogiathinh",
).replace("postgresql+asyncpg://", "postgresql://")

# Old int id → new UUID
id_map: dict[str, dict[int, uuid.UUID]] = {
    "branches": {}, "course_types": {}, "classes": {}, "students": {},
}

SCHEMA_SQL = """
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='old_system_id') THEN
        ALTER TABLE branches ADD COLUMN old_system_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='course_types' AND column_name='old_system_id') THEN
        ALTER TABLE course_types ADD COLUMN old_system_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='old_system_id') THEN
        ALTER TABLE classes ADD COLUMN old_system_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='old_system_id') THEN
        ALTER TABLE students ADD COLUMN old_system_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='class_enrollments' AND column_name='old_system_id') THEN
        ALTER TABLE class_enrollments ADD COLUMN old_system_id INTEGER;
    END IF;
END $$;
"""


async def migrate_branches(conn: asyncpg.Connection):
    schools = load_json("schools")
    if isinstance(schools, dict) and "data" in schools:
        schools = schools["data"]
    print(f"  Migrating {len(schools)} branches...")
    for s in schools:
        uid = new_id()
        id_map["branches"][s["id"]] = uid
        await conn.execute(
            """INSERT INTO branches (id, ma_chi_nhanh, ten_chi_nhanh, dia_chi, so_dien_thoai, is_active, old_system_id, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) ON CONFLICT (ma_chi_nhanh) DO NOTHING""",
            uid, s.get("code", f"CN{s['id']:03d}"), s["name"],
            s.get("address"), s.get("phone"), bool(s.get("status", 1)), s["id"],
        )
    print(f"  -> {len(schools)} branches inserted")


async def migrate_courses(conn: asyncpg.Connection):
    courses = load_json("courses")
    if isinstance(courses, dict) and "data" in courses:
        courses = courses["data"]
    print(f"  Migrating {len(courses)} course types...")
    for c in courses:
        uid = new_id()
        id_map["course_types"][c["id"]] = uid
        await conn.execute(
            """INSERT INTO course_types (id, ma_khoa_hoc, ten_khoa_hoc, loai_bang_lai, mo_ta,
                so_buoi_ly_thuyet, so_buoi_thuc_hanh, tong_gio_hoc, thoi_gian_dao_tao,
                hoc_phi, phi_thi, phi_sat_hach, tuoi_toi_thieu, is_active, old_system_id,
                created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,0,0,0,0,0,0,0,18,$6,$7,NOW(),NOW())
               ON CONFLICT (ma_khoa_hoc) DO NOTHING""",
            uid, c.get("code", f"KH{c['id']:03d}"), c["name"],
            infer_license_type(c["name"]), c.get("note"),
            bool(c.get("status", 1)) and not c.get("disabled", 0), c["id"],
        )
    print(f"  -> {len(courses)} course types inserted")


async def migrate_classrooms(conn: asyncpg.Connection):
    classrooms = load_json("classrooms")
    if isinstance(classrooms, dict) and "data" in classrooms:
        classrooms = classrooms["data"]
    print(f"  Migrating {len(classrooms)} classes...")
    for cl in classrooms:
        uid = new_id()
        id_map["classes"][cl["id"]] = uid
        course_uuid = id_map["course_types"].get(cl.get("course_id"))
        if not course_uuid:
            continue
        branch_uuid = None
        for s in cl.get("schools", []):
            branch_uuid = id_map["branches"].get(s["id"])
            if branch_uuid:
                break
        if not branch_uuid:
            branch_uuid = next(iter(id_map["branches"].values()), None)
        if not branch_uuid:
            continue
        await conn.execute(
            """INSERT INTO classes (id, branch_id, ma_lop, ten_lop, course_type_id,
                ngay_khai_giang, ngay_ket_thuc, so_luong_toi_da, so_luong_hien_tai,
                trang_thai, ghi_chu, old_system_id, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
               ON CONFLICT (ma_lop) DO NOTHING""",
            uid, branch_uuid, cl.get("code", f"LH{cl['id']:06d}"), cl["name"],
            course_uuid, parse_date(cl.get("time_start")) or date.today(),
            parse_date(cl.get("time_end")), cl.get("maximum_student") or 30,
            len(cl.get("students", [])),
            map_class_status(cl.get("status", 1), cl.get("disabled", 0)),
            cl.get("note"), cl["id"],
        )
    print(f"  -> {len(classrooms)} classes inserted")


async def migrate_students(conn: asyncpg.Connection):
    students = load_json("students")
    print(f"  Migrating {len(students)} students...")
    enrolled = 0
    skipped = 0
    seen_cccd: set[str] = set()

    for i, s in enumerate(students):
        uid = new_id()
        id_map["students"][s["id"]] = uid

        branch_uuid = None
        for sch in s.get("schools", []):
            branch_uuid = id_map["branches"].get(sch["id"])
            if branch_uuid:
                break
        if not branch_uuid:
            branch_uuid = next(iter(id_map["branches"].values()), None)
        if not branch_uuid:
            skipped += 1
            continue

        course = s.get("course")
        license_type = infer_license_type(course["name"]) if course else "A1"
        ngay_sinh = parse_date(s.get("birthday")) or date(2000, 1, 1)
        register_date = parse_date(s.get("register_date")) or parse_date(s.get("created_at")) or date.today()

        cccd = s.get("passport_number") or None
        if cccd == "":
            cccd = None
        if cccd and cccd in seen_cccd:
            cccd = None
        elif cccd:
            seen_cccd.add(cccd)

        raw_phone = s.get("phone", "")
        phone, family_contacts = parse_phone_contacts(raw_phone)

        await conn.execute(
            """INSERT INTO students (id, branch_id, ma_hoc_vien, ten_hoc_vien, ngay_sinh, gioi_tinh,
                cccd_number, cccd_issued_date, cccd_issued_place,
                so_dien_thoai, dia_chi_email, dia_chi, phuong_xa, quan_huyen, tinh_thanh,
                loai_bang_lai, trang_thai, is_repeat_student, repeat_count,
                lead_source, zalo_number, ghi_chu, ngay_dang_ky,
                old_system_id, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
                       $25::timestamptz, $26::timestamptz)
               ON CONFLICT (ma_hoc_vien) DO NOTHING""",
            uid, branch_uuid, s.get("code", f"HV{s['id']:05d}"), s.get("name", "Unknown"),
            ngay_sinh, gender_map(s.get("gender", "")),
            cccd, parse_date(s.get("passport_date")), s.get("passport_place") or None,
            phone, s.get("email") or None, s.get("address") or None,
            s.get("ward_name") or None, s.get("district_name") or None, s.get("province_name") or None,
            license_type, "active", False, 0, "walk_in", None,
            s.get("note") or None, register_date, s["id"],
            parse_date(s.get("created_at")) or datetime.now(),
            parse_date(s.get("updated_at")) or datetime.now(),
        )

        # Family contacts from compound phone
        for fc in family_contacts:
            try:
                await conn.execute(
                    """INSERT INTO student_contacts (id, student_id, phone, relation, is_primary, note, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())""",
                    new_id(), uid, fc["phone"], fc.get("relation"), False, fc.get("note"),
                )
            except Exception:
                pass

        # Class enrollments
        for cl in s.get("classrooms", []):
            class_uuid = id_map["classes"].get(cl["id"])
            if not class_uuid:
                continue
            try:
                await conn.execute(
                    """INSERT INTO class_enrollments (id, class_id, student_id, enrollment_date, is_active,
                        ly_thuyet_status, thuc_hanh_status, overall_progress, old_system_id, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
                       ON CONFLICT (class_id, student_id) DO NOTHING""",
                    new_id(), class_uuid, uid, register_date, True,
                    "not_started", "not_started", 0, cl.get("pivot", {}).get("id"),
                )
                enrolled += 1
            except Exception:
                pass

        if (i + 1) % 500 == 0:
            print(f"    ... {i + 1}/{len(students)} students processed")

    print(f"  -> {len(students) - skipped} students, {skipped} skipped, {enrolled} enrollments")


async def main():
    print("=" * 60)
    print("DATA MIGRATION: Halozend → motogiathinh")
    print("=" * 60)

    conn = await asyncpg.connect(DB_URL)
    try:
        print("\n[1/5] Schema updates...")
        await conn.execute(SCHEMA_SQL)

        print("\n[2/5] Clearing previous migration...")
        await conn.execute("DELETE FROM class_enrollments WHERE old_system_id IS NOT NULL")
        await conn.execute("DELETE FROM student_contacts WHERE student_id IN (SELECT id FROM students WHERE old_system_id IS NOT NULL)")
        await conn.execute("DELETE FROM students WHERE old_system_id IS NOT NULL")
        await conn.execute("DELETE FROM classes WHERE old_system_id IS NOT NULL")
        await conn.execute("DELETE FROM course_types WHERE old_system_id IS NOT NULL")
        await conn.execute("DELETE FROM branches WHERE old_system_id IS NOT NULL")

        print("\n[3/5] Branches...")
        await migrate_branches(conn)

        print("\n[4/5] Courses & classes...")
        await migrate_courses(conn)
        await migrate_classrooms(conn)

        print("\n[5/5] Students, contacts & enrollments...")
        await migrate_students(conn)

        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        for table in ["branches", "course_types", "classes", "students", "student_contacts", "class_enrollments"]:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
            has_col = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='old_system_id')", table
            )
            migrated = await conn.fetchval(f"SELECT COUNT(*) FROM {table} WHERE old_system_id IS NOT NULL") if has_col else count
            print(f"  {table:<25} total: {count:>6}   migrated: {migrated:>6}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
