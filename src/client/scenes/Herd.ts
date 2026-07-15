import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { HerdInit, VoteResponse, SubmitPromptResponse } from '../../shared/api';

const COL = {
  bg: 0x0b1020,
  a: 0xf4a259, // warm
  b: 0x5b8def, // cool
  good: 0x57cc99,
  bad: 0xe15b64,
  ink: '#f5f7fa',
  dim: '#9aa5b1',
  gold: '#ffd166',
};
const FONT = '"Trebuchet MS", system-ui, sans-serif';

export class Herd extends Scene {
  private initData!: HerdInit;
  private view: 'loading' | 'vote' | 'reveal' = 'loading';
  private lastResult?: VoteResponse;
  private overlay: HTMLDivElement | null = null;

  constructor() {
    super('Herd');
  }

  create() {
    this.cameras.main.setBackgroundColor(COL.bg);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
    g.generateTexture('spark', 12, 12);
    g.destroy();

    this.scale.on('resize', () => this.render());
    this.renderLoading();
    void this.load_();
  }

  private async load_() {
    try {
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error(String(res.status));
      this.initData = (await res.json()) as HerdInit;
      this.view = this.initData.hasVoted ? 'reveal' : 'vote';
      if (this.initData.hasVoted) {
        this.lastResult = {
          type: 'vote',
          votesA: this.initData.votesA,
          votesB: this.initData.votesB,
          choice: this.initData.choice ?? 'a',
          correct: this.initData.correct ?? false,
          streak: this.initData.streak,
          score: this.initData.score,
          played: this.initData.played,
          blackSheep: this.initData.blackSheep,
        };
      }
      this.render();
    } catch (e) {
      console.error('init failed', e);
      this.renderError();
    }
  }

  private render() {
    if (this.view === 'vote') this.renderVote();
    else if (this.view === 'reveal') this.renderReveal(true);
    else this.renderLoading();
  }

  private clear() {
    this.children.removeAll();
  }

  private get W() {
    return this.scale.width;
  }
  private get H() {
    return this.scale.height;
  }
  private s(n: number) {
    return Math.min(Math.min(this.W / 1024, this.H / 768), 1) * n;
  }

  private renderLoading() {
    this.clear();
    this.add
      .text(this.W / 2, this.H / 2, '🐑', { fontFamily: FONT, fontSize: this.s(72) })
      .setOrigin(0.5);
  }

  private renderError() {
    this.clear();
    this.add
      .text(this.W / 2, this.H / 2, 'Could not load the round.\nTry refreshing.', {
        fontFamily: FONT,
        fontSize: this.s(28),
        color: COL.ink,
        align: 'center',
      })
      .setOrigin(0.5);
  }

  // ---------------- VOTE ----------------
  private renderVote() {
    this.clear();
    const { W, H } = this;
    const black = this.initData.blackSheep;

    this.add
      .text(W / 2, this.s(70), 'HERD', {
        fontFamily: FONT,
        fontSize: this.s(46),
        color: COL.ink,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const goal = black
      ? '🖤 BLACK SHEEP ROUND — match the MINORITY'
      : "Guess what the CROWD will pick — not you";
    this.add
      .text(W / 2, this.s(120), goal, {
        fontFamily: FONT,
        fontSize: this.s(20),
        color: black ? COL.gold : COL.dim,
        fontStyle: black ? 'bold' : 'normal',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.34, this.initData.prompt.text, {
        fontFamily: FONT,
        fontSize: this.s(40),
        color: COL.ink,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W * 0.86 },
      })
      .setOrigin(0.5);

    const cardW = Math.min(W * 0.42, this.s(360));
    const cardH = this.s(150);
    const y = H * 0.62;
    this.makeOption(W / 2 - cardW / 2 - this.s(14), y, cardW, cardH, COL.a, this.initData.prompt.a, 'a');
    this.makeOption(W / 2 + cardW / 2 + this.s(14), y, cardW, cardH, COL.b, this.initData.prompt.b, 'b');

    this.add
      .text(W / 2, H * 0.82, 'Tap the side you think most people will choose', {
        fontFamily: FONT,
        fontSize: this.s(18),
        color: COL.dim,
      })
      .setOrigin(0.5);
    this.makeSuggestButton(W / 2, H * 0.92);
  }

  private makeOption(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    label: string,
    choice: 'a' | 'b'
  ) {
    const card = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(this.s(5), 0x0b1020);
    card.setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: this.s(28),
        color: '#10131c',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: w * 0.86 },
      })
      .setOrigin(0.5);
    card.on('pointerover', () => this.tweens.add({ targets: [card, txt], scale: 1.05, duration: 120 }));
    card.on('pointerout', () => this.tweens.add({ targets: [card, txt], scale: 1, duration: 120 }));
    card.on('pointerdown', () => {
      card.disableInteractive();
      void this.vote(choice);
    });
  }

  private async vote(choice: 'a' | 'b') {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      if (!res.ok) throw new Error(String(res.status));
      this.lastResult = (await res.json()) as VoteResponse;
      this.view = 'reveal';
      this.renderReveal(false);
    } catch (e) {
      console.error('vote failed', e);
    }
  }

  // ---------------- REVEAL ----------------
  private renderReveal(instant: boolean) {
    this.clear();
    const r = this.lastResult!;
    const { W, H } = this;
    const total = Math.max(1, r.votesA + r.votesB);
    const pctA = Math.round((r.votesA / total) * 100);
    const pctB = 100 - pctA;
    const black = r.blackSheep;

    this.add
      .text(W / 2, this.s(56), this.initData.prompt.text, {
        fontFamily: FONT,
        fontSize: this.s(26),
        color: COL.ink,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W * 0.86 },
      })
      .setOrigin(0.5);

    const penY = H * 0.44;
    const penW = Math.min(W * 0.42, this.s(360));
    const penH = this.s(230);
    const leftX = W / 2 - penW / 2 - this.s(12);
    const rightX = W / 2 + penW / 2 + this.s(12);
    this.pen(leftX, penY, penW, penH, COL.a, this.initData.prompt.a, pctA, r.choice === 'a');
    this.pen(rightX, penY, penW, penH, COL.b, this.initData.prompt.b, pctB, r.choice === 'b');

    const N = 22;
    const nA = Math.max(r.votesA > 0 ? 1 : 0, Math.round(N * (r.votesA / total)));
    const nB = N - nA;
    const spawn = () => ({ x: W / 2 + Phaser.Math.Between(-40, 40), y: penY - this.s(10) });
    const drop = (count: number, cx: number) => {
      for (let i = 0; i < count; i++) {
        const s0 = spawn();
        const sheep = this.add
          .text(s0.x, s0.y, '🐑', { fontFamily: FONT, fontSize: this.s(26) })
          .setOrigin(0.5);
        const tx = cx + Phaser.Math.Between(-penW * 0.32, penW * 0.32);
        const ty = penY + Phaser.Math.Between(-penH * 0.22, penH * 0.28);
        if (instant) {
          sheep.setPosition(tx, ty);
        } else {
          this.tweens.add({
            targets: sheep,
            x: tx,
            y: ty,
            duration: 620,
            delay: i * 22,
            ease: 'Cubic.easeOut',
          });
        }
      }
    };
    drop(nA, leftX);
    drop(nB, rightX);

    const verdict = r.correct ? 'YOU READ THE ROOM ✅' : 'MISREAD THE ROOM ❌';
    const vColor = r.correct ? COL.good : COL.bad;
    const vt = this.add
      .text(W / 2, H * 0.72, verdict, {
        fontFamily: FONT,
        fontSize: this.s(34),
        color: r.correct ? '#57cc99' : '#e15b64',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(instant ? 1 : 0);
    if (!instant) {
      this.tweens.add({ targets: vt, alpha: 1, y: H * 0.72 - this.s(6), delay: 640, duration: 260 });
      if (r.correct) this.time.delayedCall(660, () => this.burst(W / 2, H * 0.72, vColor));
    }
    if (black) {
      this.add
        .text(W / 2, H * 0.77, '🖤 minority was the winning side', {
          fontFamily: FONT,
          fontSize: this.s(16),
          color: COL.gold,
        })
        .setOrigin(0.5);
    }

    this.add
      .text(
        W / 2,
        H * 0.84,
        `🔥 Streak ${r.streak}    ·    🧠 Herd Sense ${r.score}    ·    🎯 ${r.played} played`,
        { fontFamily: FONT, fontSize: this.s(20), color: COL.ink }
      )
      .setOrigin(0.5);

    this.add
      .text(W / 2, H * 0.9, '💬 Defend your pick in the comments →', {
        fontFamily: FONT,
        fontSize: this.s(18),
        color: COL.dim,
      })
      .setOrigin(0.5);
    this.makeSuggestButton(W / 2, H * 0.965);
  }

  private pen(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    label: string,
    pct: number,
    picked: boolean
  ) {
    this.add.rectangle(x, y, w, h, color, 0.16).setStrokeStyle(this.s(picked ? 6 : 3), color);
    this.add
      .text(x, y - h / 2 - this.s(22), `${pct}%`, {
        fontFamily: FONT,
        fontSize: this.s(34),
        color: '#f5f7fa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + h / 2 + this.s(18), (picked ? '⭐ ' : '') + label, {
        fontFamily: FONT,
        fontSize: this.s(18),
        color: picked ? COL.gold : COL.dim,
        align: 'center',
        wordWrap: { width: w },
      })
      .setOrigin(0.5);
  }

  private burst(x: number, y: number, color: number) {
    const e = this.add.particles(x, y, 'spark', {
      speed: { min: 120, max: 320 },
      angle: { min: 200, max: 340 },
      lifespan: 700,
      quantity: 28,
      scale: { start: 0.9, end: 0 },
      tint: color,
      emitting: false,
    });
    e.explode(28, x, y);
    this.time.delayedCall(900, () => e.destroy());
  }

  private makeSuggestButton(x: number, y: number) {
    const t = this.add
      .text(x, y, '＋ Suggest a question', {
        fontFamily: FONT,
        fontSize: this.s(18),
        color: COL.ink,
        backgroundColor: '#1a2238',
        padding: { x: this.s(14), y: this.s(8) } as Phaser.Types.GameObjects.Text.TextPadding,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => this.showSuggest());
  }

  private showSuggest() {
    if (this.overlay) return;
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,9,18,.72);z-index:50;font-family:"Trebuchet MS",system-ui,sans-serif';
    d.innerHTML = `
      <div style="background:#111a2e;border:2px solid #2a3552;border-radius:16px;padding:22px;width:min(90vw,380px);color:#f5f7fa">
        <div style="font-size:20px;font-weight:bold;margin-bottom:4px">Suggest a HERD question</div>
        <div style="font-size:13px;color:#9aa5b1;margin-bottom:14px">A spicy either/or the whole community can argue about.</div>
        <input id="hq" maxlength="80" placeholder="Your question…" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:11px;border-radius:10px;border:1px solid #2a3552;background:#0b1020;color:#fff;font-size:15px"/>
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <input id="ha" maxlength="30" placeholder="Option A" style="flex:1;min-width:0;padding:11px;border-radius:10px;border:1px solid #f4a259;background:#0b1020;color:#fff;font-size:15px"/>
          <input id="hb" maxlength="30" placeholder="Option B" style="flex:1;min-width:0;padding:11px;border-radius:10px;border:1px solid #5b8def;background:#0b1020;color:#fff;font-size:15px"/>
        </div>
        <div id="hmsg" style="font-size:13px;color:#57cc99;min-height:18px;margin-bottom:8px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="hcancel" style="padding:10px 16px;border-radius:10px;border:0;background:#232c44;color:#cdd6e4;font-size:14px;cursor:pointer">Cancel</button>
          <button id="hsend" style="padding:10px 18px;border-radius:10px;border:0;background:#57cc99;color:#06210f;font-weight:bold;font-size:14px;cursor:pointer">Add to herd</button>
        </div>
      </div>`;
    document.body.appendChild(d);
    this.overlay = d;
    const close = () => {
      d.remove();
      this.overlay = null;
    };
    (d.querySelector('#hcancel') as HTMLButtonElement).onclick = close;
    d.onclick = (e) => {
      if (e.target === d) close();
    };
    (d.querySelector('#hsend') as HTMLButtonElement).onclick = async () => {
      const text = (d.querySelector('#hq') as HTMLInputElement).value;
      const optionA = (d.querySelector('#ha') as HTMLInputElement).value;
      const optionB = (d.querySelector('#hb') as HTMLInputElement).value;
      const msg = d.querySelector('#hmsg') as HTMLDivElement;
      msg.style.color = '#9aa5b1';
      msg.textContent = 'Sending…';
      try {
        const res = await fetch('/api/submit-prompt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, optionA, optionB }),
        });
        const j = (await res.json()) as SubmitPromptResponse;
        msg.style.color = j.ok ? '#57cc99' : '#e15b64';
        msg.textContent = j.message;
        if (j.ok) setTimeout(close, 1100);
      } catch {
        msg.style.color = '#e15b64';
        msg.textContent = 'Failed — try again.';
      }
    };
  }
}
