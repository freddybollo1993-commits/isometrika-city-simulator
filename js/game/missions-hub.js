/**
 * MISIONES: hitos en curso y logros, con el mismo esquema de pantalla completa.
 */

import { FullscreenHub, money } from './fullscreen-hub.js';
import { MISSIONS } from './missions.js';

const rewardText = (r) => [
  r.state ? `🏛️ ${money(r.state)}` : '',
  r.corp ? `💼 ${money(r.corp)}` : '',
  r.rp ? `🔬 ${r.rp} RP` : '',
].filter(Boolean).join(' · ');

export class MissionsHub extends FullscreenHub {
  constructor(game, ui) {
    super(game, ui, {
      title: 'MISIONES',
      sections: [
        { id: 'current', icon: '🎯', name: 'En curso', feat: 'linear-gradient(160deg, #fbbf24 0%, #b45309 55%, #2a1605 100%)' },
        { id: 'done', icon: '🏆', name: 'Logros', feat: 'linear-gradient(160deg, #4ade80 0%, #15803d 55%, #052e14 100%)' },
      ],
    });
    const btn = document.getElementById('btn-open-missions');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this.game.audio) this.game.audio.playClick();
        this.open('current');
      });
    }
  }

  get ms() {
    return this.game.simulation.missions;
  }

  renderSection(s) {
    return s.id === 'current' ? this._current(s) : this._done(s);
  }

  onAction(action, btn) {
    if (action !== 'claim') return;
    const res = this.ms.claim(btn.dataset.id);
    if (res.ok) {
      if (this.game.audio) this.game.audio.playChime();
      this.ui.showToast(`🎁 ${res.mission.title}: ${rewardText(res.reward)}`);
      this.ui.updateHUD(this.game.simulation, this.game.research);
    }
    this.render();
  }

  _current(s) {
    const done = this.ms.completed.length;
    const claimable = this.ms.claimable();
    const active = this.ms.active();
    const feat = this.feat(`${done}/${MISSIONS.length}`, 'misiones cumplidas', [
      claimable.length ? `🎁 ${claimable.length} premios por reclamar` : '🎯 Cumple las misiones en curso para desbloquear las siguientes',
      `Premios ajustados a la dificultad ${this.game.simulation.difficulty.icon} ${this.game.simulation.difficulty.name}`,
    ], this.meter(done / MISSIONS.length));

    const cards = [
      ...claimable.map((m) => this.card({
        icon: m.icon, title: m.title, sub: '¡Cumplida!', color: '#15803d', state: 'on',
        chips: [['🎁 Premio listo', 'pos']],
        desc: m.desc,
        footer: `<div class="hub-card-foot"><span>${rewardText(this.ms.rewardOf(m))}</span>
          <button class="hub-btn" data-action="claim" data-id="${m.id}">Reclamar</button></div>`,
      })),
      ...active.map((m) => {
        const p = this.ms.progress(m);
        return this.card({
          icon: m.icon, title: m.title, sub: m.desc, color: '#b45309',
          rows: [['Progreso', `${p} / ${m.goal}`]],
          footer: `${this.meter(p / m.goal)}<div class="hub-card-foot"><span>Premio</span><strong>${rewardText(this.ms.rewardOf(m))}</strong></div>`,
        });
      }),
    ];
    if (!cards.length) cards.push(this.card({ icon: '🏆', title: '¡Todas cumplidas!', sub: 'Eres un alcalde legendario', color: '#15803d' }));
    return this.section(s, feat, cards);
  }

  _done(s) {
    const claimed = MISSIONS.filter((m) => this.ms.claimed.includes(m.id));
    const next = MISSIONS.filter((m) => !this.ms.completed.includes(m.id)).slice(3, 6);
    const feat = this.feat(`${claimed.length}`, 'logros conseguidos', [
      next.length ? `Próximas: ${next.map((m) => m.icon).join(' ')}` : 'No quedan misiones por desbloquear',
      'Las misiones se desbloquean en orden',
    ]);
    const cards = claimed.length
      ? claimed.map((m) => this.card({ icon: m.icon, title: m.title, sub: m.desc, color: '#15803d', chips: [['✅ Conseguido', 'pos']] }))
      : [this.card({ icon: '📭', title: 'Aún sin logros', sub: 'Reclama tu primer premio en «En curso»', color: '#334155' })];
    return this.section(s, feat, cards);
  }
}
