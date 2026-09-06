import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  Focus,
  Code2,
  Layers3,
  Maximize2,
  MousePointer2,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import Scene from "./Scene";
import { createCar } from "./model";
import {
  initialState,
  isVisible,
  searchParts,
  SOURCES,
  SYSTEMS,
  type Part,
  type SystemId,
  type View,
  type ViewerState,
} from "./atlas";

export default function App() {
  const components = useMemo(() => createCar(), []),
    parts = useMemo(() => components.map((c) => c.part), [components]);
  const [state, setState] = useState<ViewerState>(initialState),
    [tab, setTab] = useState<"systems" | "parts">("systems"),
    [query, setQuery] = useState(""),
    [mobilePanel, setMobilePanel] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 850px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 850px)");
    const change = () => setNarrow(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const search = useRef<HTMLInputElement>(null),
    about = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const selected = parts.find((p) => p.id === state.selected),
    system = SYSTEMS.find((s) => s.id === selected?.system),
    results = useMemo(() => searchParts(parts, query), [parts, query]);
  const visibleCount = parts.filter((p) => isVisible(p, state)).length;
  const update = (change: Partial<ViewerState>) =>
    setState((s) => ({ ...s, ...change }));
  const reset = () => {
    setState((s) => ({
      ...initialState,
      visible: [...initialState.visible],
      reset: s.reset + 1,
    }));
    setQuery("");
    setMobilePanel(false);
  };
  const choose = (part: Part) => {
    setState((s) => ({
      ...s,
      selected: part.id,
      isolate: false,
      rotate: false,
    }));
    setMobilePanel(false);
  };
  const clear = () => update({ selected: null, isolate: false });
  const preset = (visible: SystemId[]) =>
    update({ visible, selected: null, isolate: false });
  const openSearch = () => {
    setTab("parts");
    setMobilePanel(true);
    requestAnimationFrame(() => search.current?.focus());
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !about.current?.open) {
        setMobilePanel(false);
        setState((s) => ({ ...s, selected: null, isolate: false }));
      }
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !about.current?.open
      ) {
        e.preventDefault();
        setTab("parts");
        setMobilePanel(true);
        requestAnimationFrame(() => search.current?.focus());
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (selected) heading.current?.focus({ preventScroll: true });
  }, [selected]);
  const only = (id: SystemId) => preset([id]);
  const toggle = (id: SystemId) =>
    setState((s) => ({
      ...s,
      selected: null,
      isolate: false,
      visible: s.visible.includes(id)
        ? s.visible.filter((v) => v !== id)
        : [...s.visible, id],
    }));
  return (
    <main className="atlas">
      <header className="header">
        <a className="brand" href="/" aria-label="Formula Atlas home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>
            FORMULA<span className="brand-light">ATLAS</span>
            <small>THE ANATOMY OF A RACE CAR</small>
          </span>
        </a>
        <div className="header-center">
          <span className="live-dot" /> INTERACTIVE ENGINEERING{" "}
          <span className="header-divider" /> VOL. 01
        </div>
        <nav className="header-actions" aria-label="Main navigation">
          <button
            className="search-shortcut"
            aria-label="Find a component"
            onClick={openSearch}
          >
            <Search size={16} />
            <span>Find a component</span>
            <kbd>/</kbd>
          </button>
          <button
            className="icon-button"
            onClick={() => about.current?.showModal()}
            aria-label="About this atlas"
          >
            <CircleHelp size={19} />
          </button>
          <a
            className="icon-button github-link"
            href="https://github.com/aintoniodev/formula-atlas"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <Code2 size={19} />
          </a>
        </nav>
      </header>
      <div className="workspace">
        {mobilePanel && (
          <button
            className="panel-scrim"
            aria-label="Close component panel"
            onClick={() => setMobilePanel(false)}
          />
        )}
        <aside
          className={`sidebar ${mobilePanel ? "mobile-open" : ""}`}
          aria-label="Component explorer"
          inert={narrow && !mobilePanel}
        >
          <div className="sidebar-title">
            <span>EXPLORE THE CAR</span>
            <button
              className="icon-button mobile-only"
              onClick={() => setMobilePanel(false)}
              aria-label="Close component explorer"
            >
              <X size={18} />
            </button>
            <span className="edition">3D</span>
          </div>
          <div className="tabs" role="tablist" aria-label="Explorer mode">
            <button
              role="tab"
              id="systems-tab"
              aria-selected={tab === "systems"}
              aria-controls="systems-panel"
              onClick={() => setTab("systems")}
            >
              <Layers3 size={15} />
              Systems <span>{SYSTEMS.length}</span>
            </button>
            <button
              role="tab"
              id="parts-tab"
              aria-selected={tab === "parts"}
              aria-controls="parts-panel"
              onClick={() => setTab("parts")}
            >
              <Box size={15} />
              Parts <span>{parts.length}</span>
            </button>
          </div>
          {tab === "systems" ? (
            <section
              className="systems-content"
              id="systems-panel"
              role="tabpanel"
              aria-labelledby="systems-tab"
            >
              <div className="section-label">QUICK VIEWS</div>
              <div className="presets">
                <button
                  aria-pressed={
                    state.visible.length === SYSTEMS.length && !state.isolate
                  }
                  onClick={() => preset(SYSTEMS.map((s) => s.id))}
                >
                  Complete car
                </button>
                <button
                  aria-pressed={
                    state.visible.length === 5 &&
                    [
                      "chassis",
                      "power",
                      "cooling",
                      "suspension",
                      "brakes",
                    ].every((s) => state.visible.includes(s as SystemId))
                  }
                  onClick={() =>
                    preset([
                      "chassis",
                      "power",
                      "cooling",
                      "suspension",
                      "brakes",
                    ])
                  }
                >
                  Under the skin
                </button>
              </div>
              <div className="section-label layers-label">
                <span>SYSTEM LAYERS</span>
                <button
                  onClick={() =>
                    preset(state.visible.length ? [] : SYSTEMS.map((s) => s.id))
                  }
                >
                  {state.visible.length ? "Hide all" : "Show all"}
                </button>
              </div>
              <div className="systems-list">
                {SYSTEMS.map((sys, i) => (
                  <div
                    className={`system-row ${state.visible.includes(sys.id) ? "enabled" : ""}`}
                    key={sys.id}
                  >
                    <button
                      className="system-name"
                      onClick={() => only(sys.id)}
                      title={`Show only ${sys.name}`}
                    >
                      <span className="system-index">0{i + 1}</span>
                      <span
                        className="system-dot"
                        style={{ background: sys.color }}
                      />
                      <span>{sys.name}</span>
                      <small>
                        {parts.filter((p) => p.system === sys.id).length}
                      </small>
                    </button>
                    <button
                      className="visibility-button"
                      role="switch"
                      aria-checked={state.visible.includes(sys.id)}
                      aria-label={`Show ${sys.name}`}
                      onClick={() => toggle(sys.id)}
                    >
                      {state.visible.includes(sys.id) ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <p className="layer-hint">
                Select a system name to view it on its own.
              </p>
              <div className="display-options">
                <div className="section-label">DISPLAY</div>
                <button
                  className="option-row"
                  aria-pressed={state.colors}
                  onClick={() => update({ colors: !state.colors })}
                >
                  <span>
                    <span className="color-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    Color by system
                  </span>
                  <span className={`switch ${state.colors ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
                <button
                  className="option-row"
                  aria-pressed={state.wireframe}
                  onClick={() => update({ wireframe: !state.wireframe })}
                >
                  <span>
                    <Box size={16} />
                    Wireframe
                  </span>
                  <span className={`switch ${state.wireframe ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
              </div>
            </section>
          ) : (
            <section
              className="parts-content"
              id="parts-panel"
              role="tabpanel"
              aria-labelledby="parts-tab"
            >
              <label className="search-field">
                <Search size={16} />
                <input
                  ref={search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Wing, turbo, brake…"
                  aria-label="Search components"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery("");
                      search.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <div className="section-label result-count" aria-live="polite">
                {results.length} COMPONENT{results.length === 1 ? "" : "S"}
                {query ? " FOUND" : ""}
              </div>
              <div className="part-results">
                {results.map((p) => (
                  <button
                    key={p.id}
                    className={`part-result ${selected?.id === p.id ? "selected" : ""}`}
                    onClick={() => choose(p)}
                  >
                    <span
                      className="system-dot"
                      style={{
                        background: SYSTEMS.find((s) => s.id === p.system)!
                          .color,
                      }}
                    />
                    <span>
                      {p.name}
                      <small>
                        {SYSTEMS.find((s) => s.id === p.system)!.name}
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {!results.length && (
                  <div className="empty-search">
                    <Search size={26} />
                    <p>No matching components</p>
                    <span>
                      Try a part name such as “wing” or a function such as
                      “cooling”.
                    </span>
                    <button onClick={() => setQuery("")}>Clear search</button>
                  </div>
                )}
              </div>
            </section>
          )}
          <div className="sidebar-bottom">
            <span className="live-dot" />
            <span>
              <strong>{visibleCount}</strong> / {parts.length} components
              visible
            </span>
            <button
              className="icon-button"
              onClick={reset}
              aria-label="Reset all controls"
              title="Reset all controls"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </aside>
        <section className="viewer" aria-label="3D car explorer">
          <div className="viewer-heading">
            <div>
              <div className="eyebrow">
                <span>REFERENCE MODEL</span>
                <span className="model-tag">FA–01</span>
              </div>
              <h1>
                FORMULA CAR<span>2022–2025</span>
              </h1>
            </div>
            <span className="reference-note">
              Ground-effect era
              <br />
              Generic educational model
            </span>
          </div>
          <div className="stage">
            <Scene
              components={components}
              state={state}
              onSelect={(id) => {
                const p = parts.find((p) => p.id === id);
                if (p) choose(p);
              }}
            />
            {visibleCount === 0 && (
              <div className="empty-view">
                <Layers3 size={30} />
                <h2>No systems visible</h2>
                <p>Choose a layer or restore the complete car.</p>
                <button
                  className="primary-button"
                  onClick={() => preset(SYSTEMS.map((s) => s.id))}
                >
                  Show complete car
                </button>
              </div>
            )}
          </div>
          <div className="view-toolbar">
            <div className="camera-views" aria-label="Camera presets">
              {(
                [
                  ["perspective", "¾"],
                  ["front", "Front"],
                  ["side", "Side"],
                  ["top", "Top"],
                  ["rear", "Rear"],
                ] as [View, string][]
              ).map(([view, label]) => (
                <button
                  key={view}
                  aria-label={`${view} view`}
                  aria-pressed={state.view === view && state.explode < 0.8}
                  disabled={state.explode >= 0.8}
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      view,
                      rotate: false,
                      reset: s.reset + 1,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="tool-separator" />
            <button
              className={`icon-button ${state.rotate ? "active" : ""}`}
              aria-label={state.rotate ? "Pause rotation" : "Auto rotate"}
              aria-pressed={state.rotate}
              disabled={state.explode >= 0.5 || state.isolate}
              onClick={() => update({ rotate: !state.rotate })}
            >
              {state.rotate ? <Pause size={17} /> : <RotateCw size={17} />}
            </button>
            <button
              className="icon-button"
              onClick={() => setState((s) => ({ ...s, reset: s.reset + 1 }))}
              aria-label="Fit model to view"
              title="Fit model to view"
            >
              <Maximize2 size={17} />
            </button>
          </div>
          <div className="viewer-bottom">
            <div className="model-caption">
              <span />
              {state.isolate
                ? selected?.name
                : state.explode > 0.97
                  ? "COMPONENT INVENTORY"
                  : state.explode > 0.02
                    ? "EXPLODED ASSEMBLY"
                    : "ASSEMBLED REFERENCE"}
              <span />
            </div>
            <div className="explode-panel">
              <div className="explode-icon">
                <Layers3 size={20} />
              </div>
              <div className="explode-main">
                <div className="explode-label">
                  <label htmlFor="explode">Explode car</label>
                  <output htmlFor="explode">
                    {Math.round(state.explode * 100)}
                    <span>%</span>
                  </output>
                </div>
                <input
                  id="explode"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(state.explode * 100)}
                  disabled={state.isolate}
                  style={
                    {
                      "--range": `${state.explode * 100}%`,
                    } as React.CSSProperties
                  }
                  onChange={(e) =>
                    update({
                      explode: Number(e.target.value) / 100,
                      rotate: false,
                    })
                  }
                />
                <div className="slider-labels">
                  <span>Assembled</span>
                  <span>Every component</span>
                </div>
              </div>
              <button className="reset-button" onClick={reset}>
                <RotateCcw size={17} />
                <span>Reset</span>
              </button>
            </div>
          </div>
          <div className="mobile-tools">
            <button
              onClick={() => {
                setTab("systems");
                setMobilePanel(true);
              }}
            >
              <Settings2 size={17} />
              Systems
            </button>
            <button onClick={openSearch}>
              <Search size={17} />
              Find a part
            </button>
          </div>
        </section>
        {selected && (
          <aside className="inspector" aria-label="Component details">
            <div className="inspector-top">
              <span>COMPONENT INSPECTOR</span>
              <button
                className="icon-button"
                onClick={clear}
                aria-label="Close component details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="inspector-scroll">
              <div className="detail-system" style={{ color: system?.color }}>
                <span
                  className="system-dot"
                  style={{ background: system?.color }}
                />
                {system?.name}
              </div>
              <h2 ref={heading} tabIndex={-1}>
                {selected.name}
              </h2>
              <p className="description">{selected.description}</p>
              <dl className="part-facts">
                <div>
                  <dt>Primary function</dt>
                  <dd>{selected.role}</dd>
                </div>
                <div>
                  <dt>Construction</dt>
                  <dd>{selected.material}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selected.location}</dd>
                </div>
              </dl>
              <div className="related">
                <div className="section-label">CONNECTED COMPONENTS</div>
                {selected.related
                  .map((id) => parts.find((p) => p.id === id))
                  .filter((p): p is Part => !!p)
                  .map((p) => (
                    <button key={p.id} onClick={() => choose(p)}>
                      <span>{p.name}</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
              </div>
              <a
                className="source-link"
                href={SOURCES[selected.source].url}
                target="_blank"
                rel="noreferrer"
              >
                {SOURCES[selected.source].name}
                <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="inspector-actions">
              <button
                className="primary-button"
                aria-pressed={state.isolate}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    isolate: !s.isolate,
                    explode: 0,
                    rotate: false,
                    reset: s.reset + 1,
                  }))
                }
              >
                <Focus size={17} />
                {state.isolate ? "Show surrounding car" : "Isolate component"}
                <ChevronRight size={16} />
              </button>
              <button className="clear-button" onClick={clear}>
                Clear selection
              </button>
            </div>
          </aside>
        )}
      </div>
      <footer className="footer">
        <span>
          <MousePointer2 size={13} />
          <span>
            Drag to orbit <i>·</i> Scroll to zoom <i>·</i> Click to inspect
          </span>
        </span>
        <span className="footer-mobile">
          Drag to orbit · Pinch to zoom · Tap to inspect
        </span>
        <button onClick={() => about.current?.showModal()}>
          Model notes & credits <ArrowUpRight size={13} />
        </button>
      </footer>
      <dialog
        ref={about}
        className="about-dialog"
        onClick={(e) => {
          if (e.target === about.current) about.current.close();
        }}
      >
        <div className="about-inner">
          <div className="inspector-top">
            <span>ABOUT THE ATLAS</span>
            <button
              className="icon-button"
              onClick={() => about.current?.close()}
              aria-label="Close about"
            >
              <X size={20} />
            </button>
          </div>
          <div className="eyebrow">FORMULA ATLAS / VOL. 01</div>
          <h2>
            A race car.
            <br />
            Piece by piece.
          </h2>
          <p>
            Explore {parts.length} modeled assemblies across eight systems.
            Rotate the car, remove its bodywork, or spread its components into
            an inventory.
          </p>
          <h3>The reference</h3>
          <p>
            FA–01 is an original, simplified educational model of a generic
            2022–2025 ground-effect Formula car. It does not reproduce a
            particular team’s design, certified dimensions, or every part of a
            real car. Internal packaging and geometry are schematic. The model
            uses pushrod suspension and includes the MGU-H and DRS of that era.
          </p>
          <h3>How to explore</h3>
          <ul>
            <li>Click a part to read about its function.</li>
            <li>Choose a system name to show only that layer.</li>
            <li>Move “Explode car” to 100% to see every visible assembly.</li>
            <li>
              Use the Parts catalogue for keyboard access. Press <kbd>/</kbd> to
              search and <kbd>Esc</kbd> to clear a selection.
            </li>
          </ul>
          <h3>Sources & credits</h3>
          <p>
            Inspired by{" "}
            <a
              href="https://github.com/ashemag/human-atlas"
              target="_blank"
              rel="noreferrer"
            >
              Human Atlas by ashemag
            </a>
            , released under the MIT license. Its tap-versus-drag helper is
            reused with attribution. Car geometry and component content were
            created for Formula Atlas.
          </p>
          <div className="about-sources">
            {Object.values(SOURCES).map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.name}
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
          <p className="small-note">
            An independent educational project. Not affiliated with Formula 1,
            the FIA, or any racing team. Formula 1 and related marks belong to
            their respective owners.
          </p>
          <button
            className="primary-button"
            onClick={() => about.current?.close()}
          >
            <Check size={17} />
            Back to the car
          </button>
        </div>
      </dialog>
    </main>
  );
}
