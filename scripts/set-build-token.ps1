# Saves your Expo access token as the EXPO_TOKEN secret on the public BUILD repo
# (theprojectmaker/cteen-gn-builds), which is where the app is actually built.
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
$secure = Read-Host 'Paste your Expo access token (it will not show) and press Enter' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ($token) {
  $token | & $gh secret set EXPO_TOKEN --repo theprojectmaker/cteen-gn-builds
  if ($LASTEXITCODE -eq 0) { Write-Host 'EXPO_TOKEN saved on the build repo' -ForegroundColor Green } else { Write-Host 'FAILED' -ForegroundColor Red }
} else { Write-Host 'Nothing entered, skipped.' -ForegroundColor Yellow }
$token = $null
