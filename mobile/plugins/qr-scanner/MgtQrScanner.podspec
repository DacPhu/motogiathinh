require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'MgtQrScanner'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = 'https://motogiathinh.centersai.com'
  s.author = package['author']
  s.source = { :git => 'https://motogiathinh.centersai.com', :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '13.0'
  s.dependency 'Capacitor'
  # No ML Kit pod on iOS — uses Apple AVFoundation + VisionKit (auto-linked system
  # frameworks). This also avoids the GoogleMLKit arm64-simulator link issue in CI.
  s.swift_version = '5.1'
  s.static_framework = true
end
