import { HIT_RADIUS, SWITCH_RADIUS, pickNearest } from './pick.js';
import { evaluate } from './solver.js';
import { createFactory, TOP } from './parts.js';

export async function createBoard(THREE, renderer, hooks) {
  const factory = createFactory(THREE, renderer);
  const root = new THREE.Group();
  root.name = 'circuit';
  const wood = await factory.loadWood();
  let level = null;
  let terminals = [];
  let wires = [];
  let bulbs = [];
  let battery = null;
  let sw = null;
  let switchOn = false;
  let held = null;
  let locked = false;
  let didWin = false;
  let shorted = false;
  let animTime = 0;
  let targets = [];
  const world = new THREE.Vector3();

  function clearRoot() {
    for (const wire of wires) wire.mesh.geometry?.dispose();
    while (root.children.length) root.remove(root.children[0]);
    terminals = [];
    wires = [];
    bulbs = [];
    battery = null;
    sw = null;
    switchOn = false;
    held = null;
    didWin = false;
    shorted = false;
  }

  function terminalById(id) {
    return terminals.find((t) => t.id === id) || null;
  }

  function taken(except) {
    const ids = new Set();
    for (const wire of wires) {
      for (const end of [wire.a, wire.b]) {
        if (end !== except && end.snap) ids.add(end.snap);
      }
    }
    return ids;
  }

  function wireOf(end) {
    return wires.find((wire) => wire.a === end || wire.b === end);
  }

  function links() {
    return wires
      .filter((wire) => wire.a.snap && wire.b.snap)
      .map((wire) => [wire.a.snap, wire.b.snap]);
  }

  function setSnap(end, terminal) {
    end.snap = terminal ? terminal.id : null;
    if (terminal) end.pos.set(terminal.x, terminal.y, terminal.z);
  }

  function showRing(mesh, mode) {
    if (!mesh) return;
    if (!mode) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    if (mode === 'held') {
      mesh.material.color.setHex(0x4ade80);
      mesh.material.opacity = 0.95;
      mesh.scale.setScalar(1.15);
    } else {
      mesh.material.color.setHex(0xfff3b0);
      mesh.material.opacity = 0.85;
      mesh.scale.setScalar(1);
    }
  }

  function paintRings() {
    for (const wire of wires) {
      for (const end of [wire.a, wire.b]) showRing(end.ring, held === end ? 'held' : null);
    }
    for (const t of terminals) showRing(t.ring, null);
    if (sw) showRing(sw.ring, null);
  }

  function hintFor(result) {
    if (held) return 'Acum atinge un șurub';
    if (result.short) return 'Desprinde firul de pe bornele bateriei.';
    if (result.won) return 'Becul e aprins!';
    if (level?.switch && result.progress.made === result.progress.need && !switchOn) {
      return 'Acum închide întrerupătorul.';
    }
    return level?.hint || '';
  }

  function refresh() {
    if (!level) return null;
    const result = evaluate(level, { links: links(), switchOn });
    shorted = result.short;
    if (battery) {
      const pulse = shorted ? 0.35 + 0.25 * Math.sin(animTime * 8) : 0;
      battery.holderMat.emissive.setHex(shorted ? 0xff2a00 : 0x000000);
      battery.holderMat.emissiveIntensity = pulse;
    }
    for (const bulb of bulbs) bulb.target = result.brightness[bulb.id] || 0;
    paintRings();
    hooks.onProgress?.(result.progress);
    hooks.onShort?.(result.short);
    hooks.onHint?.(hintFor(result));
    if (result.won && !didWin) {
      didWin = true;
      hooks.onWin?.();
    }
    return result;
  }

  function click(freq) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!click.ctx) click.ctx = new Ctx();
      if (click.ctx.state === 'suspended') click.ctx.resume();
      const o = click.ctx.createOscillator();
      const g = click.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, click.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.07, click.ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, click.ctx.currentTime + 0.07);
      o.connect(g);
      g.connect(click.ctx.destination);
      o.start();
      o.stop(click.ctx.currentTime + 0.08);
    } catch { /* autoplay */ }
  }

  function startSnap(end, terminal) {
    const from = end.pos.clone();
    setSnap(end, terminal);
    end.pos.copy(from);
    end.anim = {
      from,
      to: new THREE.Vector3(terminal.x, terminal.y, terminal.z),
      t: 0,
      dur: 0.18,
    };
    const wire = wireOf(end);
    if (wire) factory.rebuildWire(root, wire);
  }

  function collectTargets() {
    root.updateMatrixWorld(true);
    const list = [];
    for (const wire of wires) {
      for (const end of [wire.a, wire.b]) {
        end.clip.getWorldPosition(world);
        list.push({
          type: 'end', end, id: wire.name + '-' + end.which,
          point: [world.x, world.y, world.z], radius: HIT_RADIUS,
        });
      }
    }
    for (const t of terminals) {
      world.set(t.x, t.y, t.z);
      root.localToWorld(world);
      list.push({
        type: 'terminal', terminal: t, id: t.id,
        point: [world.x, world.y, world.z], radius: HIT_RADIUS,
      });
    }
    if (sw) {
      world.set(0.022, 0.006, 0).applyMatrix4(sw.knife.matrixWorld);
      list.push({
        type: 'switch', id: 'switch',
        point: [world.x, world.y, world.z], radius: SWITCH_RADIUS,
      });
    }
    targets = list;
  }

  function showLevel(next) {
    clearRoot();
    level = next;
    const [width, depth] = next.layout.board;
    factory.addBoard(root, wood, width, depth);
    battery = factory.addBattery(root, next.layout.battery.x, next.layout.battery.z);
    terminals.push(...battery.terminals);
    for (const spec of next.layout.bulbs) {
      const bulb = factory.addBulb(root, spec.x, spec.z, spec.id);
      bulbs.push(bulb);
      terminals.push(...bulb.terminals);
    }
    for (const spec of next.layout.switches) {
      sw = factory.addSwitch(root, spec.x, spec.z);
      terminals.push(...sw.terminals);
      factory.layoutKnife(sw, false);
    }
    next.layout.wires.forEach((spec, index) => {
      const wire = factory.makeWire(root, spec, index);
      wires.push(wire);
      factory.rebuildWire(root, wire);
    });
    refresh();
    return root;
  }

  function tap(ray) {
    if (locked || !level) return false;
    collectTargets();
    const found = pickNearest(
      [ray.origin.x, ray.origin.y, ray.origin.z],
      [ray.direction.x, ray.direction.y, ray.direction.z],
      targets,
    );
    const target = found ? found.target : null;
    if (!target) {
      if (held) {
        held = null;
        refresh();
      }
      return false;
    }
    if (target.type === 'switch') {
      switchOn = !switchOn;
      factory.layoutKnife(sw, switchOn);
      click(switchOn ? 680 : 460);
      refresh();
      return true;
    }
    if (held && target.type === 'terminal') {
      if (taken(held).has(target.id)) {
        click(180);
        return true;
      }
      startSnap(held, target.terminal);
      held = null;
      click(420);
      refresh();
      return true;
    }
    if (target.type === 'end') {
      const end = target.end;
      if (held === end) {
        held = null;
        refresh();
        return true;
      }
      if (end.snap) {
        end.snap = null;
        end.anim = null;
        const wire = wireOf(end);
        if (wire) factory.rebuildWire(root, wire);
        click(300);
      } else {
        click(540);
      }
      held = end;
      refresh();
      return true;
    }
    return false;
  }

  function connectLinks(count) {
    held = null;
    const pool = wires.slice();
    const chosen = level.links.slice(0, count);
    for (const [a, b] of chosen) {
      const wire = pool.shift();
      if (!wire) break;
      setSnap(wire.a, terminalById(a));
      setSnap(wire.b, terminalById(b));
      wire.a.anim = null;
      wire.b.anim = null;
      factory.rebuildWire(root, wire);
    }
    return refresh();
  }

  function connectSolution() {
    connectLinks(level.links.length);
    if (level.switch) {
      switchOn = true;
      factory.layoutKnife(sw, true);
    }
    const result = refresh();
    for (const bulb of bulbs) {
      bulb.heat = bulb.target || 0;
      factory.paintBulb(bulb, bulb.heat);
    }
    return result;
  }

  function filamentPoints() {
    const pts = [];
    for (const bulb of bulbs) {
      const p = new THREE.Vector3(0, 0.0422, 0);
      bulb.group.localToWorld(p);
      pts.push(p);
    }
    return pts;
  }

  function update(dt) {
    if (!level) return;
    animTime += dt;
    const dirty = new Set();
    for (const wire of wires) {
      for (const end of [wire.a, wire.b]) {
        if (!end.anim) continue;
        end.anim.t += dt;
        const u = Math.min(1, end.anim.t / end.anim.dur);
        const s = u * u * (3 - 2 * u);
        end.pos.lerpVectors(end.anim.from, end.anim.to, s);
        dirty.add(wire);
        if (u >= 1) end.anim = null;
      }
    }
    for (const wire of dirty) factory.rebuildWire(root, wire);
    const flick = 1;
    for (const bulb of bulbs) {
      const target = bulb.target || 0;
      const tau = target > bulb.heat ? 0.12 : 0.42;
      bulb.heat += (target - bulb.heat) * (1 - Math.exp(-Math.min(0.05, dt) / tau));
      if (bulb.heat < 0.001) bulb.heat = 0;
      const wobble = bulb.heat > 0.35 ? 1 + Math.sin(animTime * 47) * 0.02 : flick;
      factory.paintBulb(bulb, bulb.heat * wobble);
    }
    if (shorted && battery) {
      battery.holderMat.emissiveIntensity = 0.35 + 0.25 * Math.sin(animTime * 8);
    }
  }

  function brightness() {
    const out = {};
    for (const bulb of bulbs) out[bulb.id] = bulb.heat;
    return out;
  }

  return {
    root,
    showLevel,
    tap,
    update,
    connectSolution,
    connectLinks,
    filamentPoints,
    brightness,
    setLocked(value) { locked = !!value; if (locked) held = null; },
    reset() { if (level) showLevel(level); },
  };
}

export { TOP };
