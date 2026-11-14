/// <reference types="node" />
// The bundled demo farms (pipeline/build_demo.py, #8) follow the shared `LotData` contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LotData, MonthlySeries } from '../types';

const DIR = join(process.cwd(), 'assets', 'data', 'demo');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

const twelve = (s: MonthlySeries | null, name: string) => {
  assert.ok(s !== null, name);
  assert.equal(s.length, 12, name);
  assert.ok(s.every((v) => v !== null && Number.isFinite(v)), `${name} has a missing month`);
};

test('there is at least one demo farm', () => {
  assert.ok(files.length >= 1);
});

for (const f of files) {
  test(`demo farm ${f} matches the LotData contract`, () => {
    const d = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as LotData;
    assert.equal(d.kind, 'demo');
    assert.equal(d.id, f.replace('.json', ''));
    assert.ok(d.name);
    const m = d.monthly;
    for (const k of ['p20', 'p50', 'p80'] as const) twelve(m.precip_mm[k], `precip ${k}`);
    for (const [k, s] of Object.entries({ et0: m.et0_mm, tmax: m.tmax_c, tmin: m.tmin_c, wet: m.rootzone_wetness, rh: m.rh2m_pct, ws: m.ws2m_ms, rs: m.solar_mj_m2_day, heat: m.heat_days_gt35, heavy: m.heavy_rain_days_gt50mm })) {
      twelve(s, k);
    }
    for (let i = 0; i < 12; i++) {
      assert.ok((m.precip_mm.p20[i] as number) <= (m.precip_mm.p50[i] as number), `p20 <= p50, month ${i + 1}`);
      assert.ok((m.precip_mm.p50[i] as number) <= (m.precip_mm.p80[i] as number), `p50 <= p80, month ${i + 1}`);
      assert.ok((m.tmin_c[i] as number) < (m.tmax_c[i] as number), `tmin < tmax, month ${i + 1}`);
    }
    // Sanity range for annual ET0 at a humid lowland tropical point (docs/07 section 7).
    const et0Year = (m.et0_mm as number[]).reduce((a, b) => a + b, 0);
    assert.ok(et0Year > 1000 && et0Year < 1600, `annual ET0 ${et0Year}`);
    assert.ok(d.trends && d.trends.method.length > 0);
    assert.ok(d.provenance.length > 0 && d.provenance.every((p) => p.source && p.period && p.retrieved));
    assert.ok(d.caveats.some((c) => c.includes('grid cell')));
  });
}
