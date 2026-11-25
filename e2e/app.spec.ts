import { expect, test, type Page } from '@playwright/test';

const NIGHT = new Date('2026-11-25T21:30:00-04:00');
const PATTERN = [1, 2, 3, 6, 9];

async function draw(page: Page, dots: number[]) {
  const centers = [];
  for (const d of dots) {
    const box = await page.locator(`[data-dot="${d}"]`).first().boundingBox();
    if (!box) throw new Error(`sin punto ${d}`);
    centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  await page.mouse.move(centers[0]!.x, centers[0]!.y);
  await page.mouse.down();
  for (const c of centers.slice(1)) await page.mouse.move(c.x, c.y, { steps: 6 });
  await page.mouse.up();
}

async function setup(page: Page) {
  await page.clock.install({ time: NIGHT });
  await page.goto('./');
  await page.getByLabel('¿Cómo te llamo? (opcional)').fill('Ana');
  await page.getByRole('button', { name: 'Empezar mi diario' }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu patrón' })).toBeVisible();
  await draw(page, PATTERN);
  await expect(page.getByRole('heading', { name: 'Repite tu patrón' })).toBeVisible();
  await draw(page, PATTERN);
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
}

const nav = (page: Page, name: string) => page.locator('nav.nav').getByRole('button', { name }).click();

test('escribe con teclado, carita, etiqueta que se recuerda y racha', async ({ page }) => {
  await setup(page);
  await expect(page.getByText('Pregunta del día')).toBeVisible();
  await page.getByRole('radio', { name: 'Bien', exact: true }).click();
  await page.getByRole('radio', { name: '⌨️ Teclado o voz' }).click();
  await page.getByLabel('Lo que pasó hoy').fill('Hoy fui al gym y estudié anatomía.');
  await page.getByLabel('⭐ Lo mejor del día').fill('La cena con mi familia');
  await page.getByLabel('Nueva etiqueta').fill('gym');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByRole('button', { name: '#gym' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Guardar mi día' }).click();
  await expect(page.getByText('Día guardado · 100 %')).toBeVisible();
  await expect(page.getByLabel('Racha de 1 días')).toBeVisible();

  // Al otro día, la etiqueta ya está como botón y se sugiere sola.
  await page.clock.setFixedTime(new Date('2026-11-26T21:00:00-04:00'));
  await page.reload();
  await draw(page, PATTERN);
  await page.getByRole('radio', { name: '⌨️ Teclado o voz' }).click();
  await page.getByLabel('Lo que pasó hoy').fill('Otra vez al gym temprano');
  await expect(page.getByRole('button', { name: '+ #gym' })).toBeVisible();
  await expect(page.getByRole('button', { name: '#gym', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await nav(page, 'Buscar');
  await page.getByLabel('Buscar').fill('anatomia');
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.item')).toContainText('Hoy fui al gym');
});

test('escribe a mano en la hoja con renglones y se ve en el calendario', async ({ page }) => {
  await setup(page);
  await page.getByRole('radio', { name: '✍️ A mano' }).click();
  await expect(page.getByLabel('Tipo de hoja')).toHaveValue('renglon');
  const sheet = page.getByLabel('Hoja para escribir a mano');
  await sheet.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  const box = (await sheet.boundingBox())!;
  await page.mouse.move(box.x + 120, box.y + 180);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 120 + i * 12, box.y + 180 + (i % 2) * 10, { steps: 2 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Guardar mi día' }).click();
  await expect(page.getByText('Día guardado · 100 %')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deshacer' })).toBeEnabled();

  await nav(page, 'Calendario');
  await page.getByRole('button', { name: /miércoles 25 de noviembre, escrito/ }).click();
  await expect(page.getByRole('img', { name: /Hoja escrita a mano/ })).toBeVisible();

  await nav(page, 'Avance');
  await expect(page.locator('.tile').filter({ hasText: 'Días seguidos' })).toContainText('1');
  await expect(page.getByText('Una semana')).toBeVisible();
});
