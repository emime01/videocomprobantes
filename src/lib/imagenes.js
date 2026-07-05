// Compresión client-side antes de subir. Ver SPEC.md sección 9.
export function comprimirImagen(file, { maxLado = 2400, calidad = 0.85, fondoBlanco = false } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const width = Math.round(img.width * escala);
        const height = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (fondoBlanco) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function comprimirFoto(file) {
  return comprimirImagen(file, { maxLado: 2400, calidad: 0.85 });
}

export function comprimirArte(file) {
  return comprimirImagen(file, { maxLado: 1600, calidad: 0.85, fondoBlanco: true });
}

export function genId(prefijo) {
  return `${prefijo}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slugify(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
