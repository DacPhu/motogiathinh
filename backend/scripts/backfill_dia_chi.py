"""One-time backfill: convert legacy students' OLD address (dia_chi_cccd) → NEW
address (dia_chi) via diachi.io.

Adaptive: `_call_diachi` includes DIACHI_API_KEY when set (fast, no throttle); on the
free tier it gets rate-limited, so we sleep and retry. Fallback: if a ward can't be
converted, dia_chi is left unchanged (= dia_chi_cccd, the old address), per spec.

Run on the server:
  docker compose exec -T backend python /app/scripts/backfill_dia_chi.py
"""
import asyncio

from sqlalchemy import or_, select, update

from app.database.session import AsyncSessionLocal
from app.models.student import Student
from app.routers.address import _call_diachi
from app.utils.vn_address import recombine, split_address

BATCH = 50  # admin tails per diachi batch


async def main():
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Student.id, Student.dia_chi_cccd).where(
                Student.deleted_at.is_(None),
                Student.dia_chi_cccd.isnot(None),
                Student.cccd_qr_raw.is_(None),  # legacy only (new scans already store the new dia_chi)
                or_(Student.dia_chi.is_(None), Student.dia_chi == Student.dia_chi_cccd),  # not yet converted
            )
        )).all()
    print(f"{len(rows)} legacy students to convert", flush=True)

    plans = []            # (id, detail, admin)
    tails: dict = {}      # unique admin tails
    for sid, old in rows:
        detail, admin = split_address(old)
        plans.append((sid, detail, admin))
        if admin:
            tails[admin] = None
    uniq = list(tails)
    print(f"{len(uniq)} unique ward tails to send to diachi.io", flush=True)

    conv: dict = {}
    i = 0
    while i < len(uniq):
        batch = uniq[i:i + BATCH]
        data, err, rl = await _call_diachi(batch)
        if data is None:
            if rl:
                print("rate-limited; sleeping 305s…", flush=True)
                await asyncio.sleep(305)
                continue
            print(f"batch error: {err}; skipping {len(batch)} tails", flush=True)
            i += BATCH
            continue
        for item in (data.get("data") or {}).get("results", []):
            c = (item.get("converted") or "").strip()
            if c and item.get("success"):
                conv[item.get("original", "")] = c
        i += BATCH
        print(f"converted {min(i, len(uniq))}/{len(uniq)} tails", flush=True)

    async with AsyncSessionLocal() as db:
        n = 0
        for sid, detail, admin in plans:
            if not (admin and admin in conv):
                continue  # fallback: leave dia_chi = dia_chi_cccd (old) unchanged
            await db.execute(update(Student).where(Student.id == sid).values(dia_chi=recombine(detail, conv[admin])))
            n += 1
            if n % 500 == 0:
                await db.commit()
                print(f"saved {n}", flush=True)
        await db.commit()
    print(f"done: {n} students converted (rest left as old per fallback)", flush=True)


asyncio.run(main())
