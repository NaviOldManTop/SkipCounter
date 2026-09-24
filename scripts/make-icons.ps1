# Renders the PNG app icons (same design as icons/icon.svg) with System.Drawing.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\icons'
New-Item -ItemType Directory -Force $outDir | Out-Null

function New-Icon([int]$size, [string]$fileName) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Full-bleed background: iOS and Android apply their own corner mask.
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $from = [System.Drawing.ColorTranslator]::FromHtml('#7478ff')
    $to = [System.Drawing.ColorTranslator]::FromHtml('#4b4fe0')
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $from, $to, 45.0
    $g.FillRectangle($bg, $rect)

    $k = $size / 512.0
    $white = [System.Drawing.Color]::White
    $brush = New-Object System.Drawing.SolidBrush $white
    $pen = New-Object System.Drawing.Pen $white, ([single](28 * $k))
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    foreach ($x in @(132, 240)) {
        $pts = [System.Drawing.PointF[]]@(
            (New-Object System.Drawing.PointF ([single]($x * $k)), ([single](170 * $k))),
            (New-Object System.Drawing.PointF ([single]($x * $k)), ([single](342 * $k))),
            (New-Object System.Drawing.PointF ([single](($x + 108) * $k)), ([single](256 * $k)))
        )
        $g.FillPolygon($brush, $pts)
        $g.DrawPolygon($pen, $pts)
    }

    $barPen = New-Object System.Drawing.Pen $white, ([single](34 * $k))
    $barPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $barPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($barPen, [single](380 * $k), [single](170 * $k), [single](380 * $k), [single](342 * $k))

    $path = Join-Path $outDir $fileName
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output "wrote $path"
}

New-Icon 180 'apple-touch-icon.png'
New-Icon 192 'icon-192.png'
New-Icon 512 'icon-512.png'
