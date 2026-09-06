import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SYSTEMS, isVisible, type ViewerState } from "./atlas";
import type { Component } from "./model";
import { inventoryLayout } from "./layout";
import { PointerTap } from "./pointer-tap";

interface Props {
  components: Component[];
  state: ViewerState;
  onSelect: (id: string) => void;
}
export default function Scene({ components, state, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(state),
    select = useRef(onSelect);
  const [error, setError] = useState("");
  latest.current = state;
  select.current = onSelect;
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "Your browser could not start the 3D viewer. Enable hardware acceleration or try another browser. You can still explore every component through the catalogue.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive Formula car. Drag to orbit, scroll or pinch to zoom. Use the component catalogue for keyboard selection.",
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("data-testid", "car-canvas");
    el.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.01, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.25;
    controls.maxDistance = 65;
    controls.maxPolarAngle = Math.PI * 0.95;
    controls.autoRotateSpeed = 0.6;
    const environment = new RoomEnvironment(),
      pmrem = new T.PMREMGenerator(renderer),
      env = pmrem.fromScene(environment, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.65;
    environment.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight(0xcfe1ff, 0x303537, 1.1));
    const key = new T.DirectionalLight(0xffeee3, 2.2);
    key.position.set(-3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0003;
    scene.add(key);
    const rim = new T.DirectionalLight(0xa6c4ed, 1.4);
    rim.position.set(3, 2, -4);
    scene.add(rim);
    const ground = new T.Mesh(
      new T.PlaneGeometry(200, 200),
      new T.ShadowMaterial({ opacity: 0.24 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.013;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new T.GridHelper(12, 24, 0x454a4b, 0x2a3032);
    grid.position.y = -0.015;
    (grid.material as T.Material).transparent = true;
    (grid.material as T.Material).opacity = 0.22;
    scene.add(grid);
    components.forEach((c) => scene.add(c.group));
    const hover = document.createElement("div");
    hover.className = "part-tooltip";
    hover.hidden = true;
    el.append(hover);
    const labels = new Map<string, HTMLButtonElement>();
    components.forEach((c) => {
      const label = document.createElement("button");
      label.className = "inventory-label";
      label.textContent = c.part.name;
      label.hidden = true;
      label.tabIndex = -1;
      label.addEventListener("click", () => select.current(c.part.id));
      el.append(label);
      labels.set(c.part.id, label);
    });
    let frame = 0,
      dirty = true,
      last: ViewerState | null = null,
      amount = state.explode,
      lastTime = performance.now(),
      layout = inventoryLayout(components, 1),
      disposed = false,
      hovered: string | null = null;
    const direction = () =>
      latest.current.explode > 0.65 && !latest.current.isolate
        ? new T.Vector3(0, 0, 1)
        : latest.current.view === "front"
          ? new T.Vector3(-1, 0.045, 0)
          : latest.current.view === "rear"
            ? new T.Vector3(1, 0.045, 0)
            : latest.current.view === "side"
              ? new T.Vector3(0, 0.02, 1)
              : latest.current.view === "top"
                ? new T.Vector3(0, 1, 0.0001)
                : new T.Vector3(-1, 0.66, 1.1).normalize();
    function fit() {
      const s = latest.current,
        visible = components.filter((c) => isVisible(c.part, s));
      if (!visible.length) return;
      const bounds = new T.Box3();
      visible.forEach((c) => bounds.union(new T.Box3().setFromObject(c.group)));
      const center = bounds.getCenter(new T.Vector3()),
        size = bounds.getSize(new T.Vector3());
      if (s.explode > 0.65 && !s.isolate) {
        size.set(layout.width, layout.height + 0.25, 1);
        center.set(0, 0, 0);
      }
      const dir = direction(),
        right = new T.Vector3()
          .crossVectors(new T.Vector3(0, 1, 0), dir)
          .normalize(),
        up = new T.Vector3().crossVectors(dir, right).normalize();
      const projectedWidth =
        Math.abs(right.x) * size.x +
        Math.abs(right.y) * size.y +
        Math.abs(right.z) * size.z;
      const projectedHeight =
        Math.abs(up.x) * size.x +
        Math.abs(up.y) * size.y +
        Math.abs(up.z) * size.z;
      const depth =
        Math.abs(dir.x) * size.x +
        Math.abs(dir.y) * size.y +
        Math.abs(dir.z) * size.z;
      const distance =
        (Math.max(projectedHeight, projectedWidth / camera.aspect) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
          1.07 +
        depth * 0.22;
      controls.target.copy(center);
      camera.position
        .copy(center)
        .addScaledVector(dir, Math.max(0.35, distance));
      controls.update();
      dirty = true;
    }
    function resize() {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      layout = inventoryLayout(
        components.filter((c) => isVisible(c.part, latest.current)),
        camera.aspect,
      );
      last = null;
      fit();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2(),
      tap = new PointerTap();
    function pick(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        components.filter((c) => c.group.visible).map((c) => c.group),
        true,
      );
      let target: T.Object3D | undefined = hits[0]?.object;
      while (target && !target.userData.partId)
        target = target.parent ?? undefined;
      return target?.userData.partId as string | undefined;
    }
    function down(e: PointerEvent) {
      tap.down(
        e.pointerId,
        e.clientX,
        e.clientY,
        e.pointerType === "touch" ? 12 : 5,
      );
      hover.hidden = true;
    }
    function move(e: PointerEvent) {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || e.pointerType === "touch") {
        hover.hidden = true;
        return;
      }
      const id = pick(e);
      if (hovered !== (id ?? null)) {
        hovered = id ?? null;
        dirty = true;
      }
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      hover.hidden = !id;
      if (id) {
        const rect = el.getBoundingClientRect();
        hover.textContent = components.find((c) => c.part.id === id)!.part.name;
        hover.style.left = `${Math.min(e.clientX - rect.left + 14, Math.max(8, rect.width - 225))}px`;
        hover.style.top = `${Math.max(8, e.clientY - rect.top - 36)}px`;
      }
    }
    function up(e: PointerEvent) {
      if (tap.up(e.pointerId, e.clientX, e.clientY)) {
        const id = pick(e);
        if (id) select.current(id);
      }
    }
    function cancel(e: PointerEvent) {
      tap.cancel(e.pointerId);
      hover.hidden = true;
    }
    function leave() {
      hover.hidden = true;
      hovered = null;
      dirty = true;
    }
    function contextLost(e: Event) {
      e.preventDefault();
      setError(
        "The 3D session was interrupted. Reload the viewer to restore it. The component catalogue is still available.",
      );
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    controls.addEventListener("change", () => {
      dirty = true;
    });
    const selectedColor = new T.Color("#ff8754");
    function animate(time: number) {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.25);
      lastTime = time;
      const s = latest.current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        amount = s.explode;
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = T.MathUtils.damp(amount, s.explode, 7, dt);
        if (Math.abs(amount - s.explode) < 0.0001) amount = s.explode;
        dirty = true;
      }
      const changed = last !== s;
      if (changed || moving) {
        if (changed)
          layout = inventoryLayout(
            components.filter((c) => isVisible(c.part, s)),
            camera.aspect,
          );
        const blend = T.MathUtils.smoothstep(amount, 0.48, 1);
        components.forEach((c) => {
          c.group.visible = isVisible(c.part, s);
          const cell = layout.cells.get(c.part.id);
          const spread = c.center
            .clone()
            .add(
              new T.Vector3(
                c.center.x * 0.34,
                (c.center.y - 0.2) * 1.5 + 0.25,
                Math.sign(c.center.z) * 0.8,
              ),
            )
            .sub(c.center)
            .multiplyScalar(Math.min(amount / 0.48, 1));
          c.group.position.copy(c.center).add(spread);
          if (cell)
            c.group.position.lerp(
              new T.Vector3(cell.x, cell.y + 0.08, 0),
              blend,
            );
        });
        scene.updateMatrixWorld(true);
        if (
          moving ||
          !last ||
          s.view !== last.view ||
          s.reset !== last.reset ||
          s.isolate !== last.isolate ||
          s.visible !== last.visible ||
          (s.isolate && s.selected !== last.selected)
        )
          fit();
        dirty = true;
      }
      controls.enableRotate = amount < 0.8;
      controls.autoRotate = s.rotate && amount < 0.5 && !s.isolate;
      controls.update();
      ground.visible = grid.visible = amount < 0.08 && !s.isolate;
      renderer.shadowMap.enabled = ground.visible;
      if (changed || moving) renderer.shadowMap.needsUpdate = true;
      if (dirty) {
        components.forEach((c) => {
          c.group.traverse((o) => {
            if (o instanceof T.Mesh) {
              const m = o.material as T.MeshStandardMaterial;
              const selected = c.part.id === s.selected;
              const color = s.colors
                ? SYSTEMS.find((sys) => sys.id === c.part.system)!.color
                : m.userData.original;
              m.color.set(color);
              if (selected) m.color.lerp(selectedColor, 0.5);
              m.emissive.set(
                selected
                  ? "#ea5625"
                  : c.part.id === hovered
                    ? "#756554"
                    : "#000000",
              );
              m.emissiveIntensity = selected ? 0.19 : 0.07;
              m.wireframe = s.wireframe;
            }
          });
        });
        renderer.render(scene, camera);
        renderer.domElement.dataset.explode = amount.toFixed(3);
        components.forEach((c) => {
          const label = labels.get(c.part.id)!;
          const show = amount > 0.97 && c.group.visible && !s.isolate;
          label.hidden = !show;
          if (show) {
            const pos = c.group.position.clone();
            pos.y -= c.size.y / 2 + 0.13;
            pos.project(camera);
            label.style.left = `${((pos.x + 1) / 2) * el.clientWidth}px`;
            label.style.top = `${((1 - pos.y) / 2) * el.clientHeight}px`;
            const cell = layout.cells.get(c.part.id)!;
            const edge = c.group.position
              .clone()
              .add(new T.Vector3(cell.width / 2, 0, 0))
              .project(camera);
            label.style.maxWidth = `${Math.max(12, Math.abs(edge.x - pos.x) * el.clientWidth - 6)}px`;
            label.classList.toggle("selected", c.part.id === s.selected);
          }
        });
        dirty = false;
      }
      last = s;
    }
    resize();
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      components.forEach((c) => {
        c.group.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            (o.material as T.Material).dispose();
          }
        });
      });
      ground.geometry.dispose();
      ground.material.dispose();
      grid.geometry.dispose();
      (grid.material as T.Material).dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      hover.remove();
      labels.forEach((l) => l.remove());
    };
  }, [components]);
  return (
    <div className="scene" ref={host}>
      {error && (
        <div className="viewer-error" role="alert">
          <strong>3D viewer unavailable</strong>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Reload viewer</button>
        </div>
      )}
    </div>
  );
}
