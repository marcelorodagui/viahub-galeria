# Publicación diaria de la galería (la corre la tarea programada "Vía Hub - Publicar galería").
# Saca a la web las piezas programadas con [dd-mm-aaaa] cuyo día ya llegó; si no hay cambios, no sube nada.
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # la salida de node viene en UTF-8
$raiz = Split-Path -Parent $PSScriptRoot
$origen = 'G:\Mi unidad\Vía Hub Studio\Galería web'
$registro = Join-Path (Split-Path -Parent $raiz) 'viahub-galeria-registro.log'

function Anotar($texto) { Add-Content -LiteralPath $registro -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $texto" -Encoding utf8 }

# Google Drive puede tardar en montar G: si la computadora recién se encendió
for ($i = 0; $i -lt 20 -and -not (Test-Path -LiteralPath $origen); $i++) { Start-Sleep -Seconds 30 }
if (-not (Test-Path -LiteralPath $origen)) { Anotar 'Google Drive no está disponible; no se publicó.'; exit 1 }

Anotar 'Inicio'
& node (Join-Path $raiz 'herramientas\construir.mjs') --publicar 2>&1 |
  Where-Object { $_ -match 'Programadas|⏳|quitado|Listo|Publicado|No hay cambios|✖|⚠' } |
  ForEach-Object { Anotar "  $_" }
Anotar "Fin (código $LASTEXITCODE)"
exit $LASTEXITCODE
