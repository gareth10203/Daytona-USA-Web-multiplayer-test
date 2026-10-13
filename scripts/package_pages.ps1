$ErrorActionPreference='Stop'
$variantRoot=(Resolve-Path "$PSScriptRoot/..").Path
$stageRoot=Join-Path $variantRoot ('build/pages-package-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $stageRoot | Out-Null
Copy-Item "$variantRoot/dist/*" $stageRoot -Recurse -Force
foreach($sourceFolder in @('web','bridge','scripts','tests','docs')){Copy-Item -LiteralPath (Join-Path $variantRoot $sourceFolder) -Destination $stageRoot -Recurse -Force}
foreach($sourceFile in @('README.md','LICENSE','THIRD_PARTY.md','NOTICE.md','BUILD.md','package.json','.gitignore')){Copy-Item -LiteralPath (Join-Path $variantRoot $sourceFile) -Destination $stageRoot -Force}
[System.IO.File]::WriteAllText((Join-Path $stageRoot '.nojekyll'),'')
Add-Content -LiteralPath (Join-Path $stageRoot '.gitignore') -Value "`n# Compiled engine for GitHub Pages.`n!/daytona_engine.js`n!/daytona_engine.wasm"
$manifest=Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Force | Sort-Object FullName | ForEach-Object {(Get-FileHash -LiteralPath $_.FullName).Hash.ToLower()+'  '+$_.FullName.Substring($stageRoot.Length+1).Replace('\','/')}
[System.IO.File]::WriteAllLines((Join-Path $stageRoot 'MANIFEST.sha256'),$manifest,[System.Text.UTF8Encoding]::new($false))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath=Join-Path $variantRoot 'daytona_multiplayer_optimized_github_pages.zip'
$stream=[System.IO.File]::Open($archivePath,[System.IO.FileMode]::Create)
$archive=[System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create)
try{foreach($entry in (Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Force)){[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$entry.FullName,$entry.FullName.Substring($stageRoot.Length+1).Replace('\','/'),[System.IO.Compression.CompressionLevel]::Optimal)|Out-Null}}finally{$archive.Dispose();$stream.Dispose()}
Write-Host "GitHub Pages ZIP: $archivePath"
