/** Download helpers for the rendered plate. */

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

export function downloadSvg(svg: string, name: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  download(url, `${name}.svg`);
  URL.revokeObjectURL(url);
}

export function downloadPng(svg: string, name: string, scale = 3) {
  // Give the SVG explicit pixel dimensions so the Image decodes at full size.
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg);
  if (vb) {
    svg = svg.replace('<svg ', `<svg width="${Math.ceil(Number(vb[3]))}" height="${Math.ceil(Number(vb[4]))}" `);
  }
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(img.naturalWidth * scale);
    canvas.height = Math.ceil(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const pngUrl = URL.createObjectURL(png);
      download(pngUrl, `${name}.png`);
      URL.revokeObjectURL(pngUrl);
    });
  };
  img.src = url;
}
