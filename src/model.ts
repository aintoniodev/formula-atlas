import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Finish, Part, SystemId, Vec3 } from "./atlas";

// Original, schematic geometry. Coordinates in metres: nose -X, left +Z, up +Y.
// Assemblies are selectable educational units, not individual fasteners or CAD parts.
export interface Component {
  part: Part;
  group: T.Group;
  center: T.Vector3;
  size: T.Vector3;
}
const palette: Record<Finish, string> = {
  paint: "#e65027",
  carbon: "#252b2e",
  metal: "#9aa6ad",
  rubber: "#171a1d",
  gold: "#bd9152",
  dark: "#101719",
  red: "#fa342b",
};
export function makeMaterial(finish: Finish) {
  const m = new T.MeshStandardMaterial({
    color: palette[finish],
    metalness:
      finish === "metal" || finish === "gold"
        ? 0.75
        : finish === "paint"
          ? 0.38
          : 0.14,
    roughness: finish === "rubber" ? 0.85 : finish === "paint" ? 0.3 : 0.52,
  });
  m.userData.finish = finish;
  m.userData.original = palette[finish];
  return m;
}
function mesh(
  geometry: T.BufferGeometry,
  finish: Finish,
  position: Vec3 = [0, 0, 0],
  rotation: Vec3 = [0, 0, 0],
) {
  const m = new T.Mesh(geometry, makeMaterial(finish));
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function box(
  size: Vec3,
  at: Vec3,
  finish: Finish = "carbon",
  rotation: Vec3 = [0, 0, 0],
) {
  return mesh(new T.BoxGeometry(...size), finish, at, rotation);
}
function rod(a: Vec3, b: Vec3, radius = 0.018, finish: Finish = "carbon") {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    direction = end.clone().sub(start);
  const m = mesh(
    new T.CylinderGeometry(radius, radius, direction.length(), 12),
    finish,
  );
  m.position.copy(start.add(end).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return m;
}
function tube(points: Vec3[], radius: number, finish: Finish) {
  return mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      48,
      radius,
      10,
      false,
    ),
    finish,
  );
}
// Elliptical cross sections lofted along the longitudinal axis.
function loft(
  sections: [number, number, number, number][],
  finish: Finish,
  z = 0,
) {
  const v: number[] = [],
    idx: number[] = [],
    n = 32;
  sections.forEach(([x, y, ry, rz]) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      v.push(x, y + Math.sin(a) * ry, z + Math.cos(a) * rz);
    }
  });
  for (let j = 0; j < sections.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n),
        c = (j + 1) * n + i,
        d = (j + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  for (let i = 1; i < n - 1; i++) {
    idx.push(0, i, i + 1);
    const o = (sections.length - 1) * n;
    idx.push(o, o + i + 1, o + i);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, finish);
}
// Cambered wing with a swept span and tapered tips. The profile is closed.
function wing(
  x: number,
  y: number,
  span: number,
  chord: number,
  finish: Finish,
  sweep = 0.13,
  rise = 0.09,
) {
  const vertices: number[] = [],
    indices: number[] = [];
  const steps = 40,
    rings = 24;
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * 2 - 1;
    const taper = 1 - 0.16 * Math.pow(Math.abs(t), 4);
    for (let p = 0; p < rings; p++) {
      const angle = (p / rings) * Math.PI * 2;
      const u = (1 - Math.cos(angle)) / 2;
      vertices.push(
        x + (u - 0.5) * chord * taper + sweep * t * t,
        y +
          rise * t * t +
          0.07 * chord * Math.sin(Math.PI * u) +
          Math.sin(angle) * chord * 0.035,
        (t * span) / 2,
      );
    }
  }
  for (let s = 0; s < steps; s++)
    for (let p = 0; p < rings; p++) {
      const a = s * rings + p,
        b = s * rings + ((p + 1) % rings),
        c = a + rings,
        d = b + rings;
      indices.push(a, b, c, b, d, c);
    }
  for (let p = 1; p < rings - 1; p++) {
    indices.push(0, p + 1, p);
    const a = steps * rings;
    indices.push(a, a + p, a + p + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return mesh(g, finish);
}
function ring(radius: number, thickness: number, at: Vec3, finish: Finish) {
  return mesh(new T.TorusGeometry(radius, thickness, 12, 64), finish, at);
}

export function createCar(): Component[] {
  const components: Component[] = [];
  function add(
    id: string,
    name: string,
    system: SystemId,
    description: string,
    role: string,
    material: string,
    location: string,
    objects: T.Object3D[],
    related: string[] = [],
    source: Part["source"] = "regulations",
  ) {
    // Bake and batch each assembly by finish. Selection still addresses the whole assembly.
    const batches = new Map<Finish, T.BufferGeometry[]>();
    objects.forEach((object) => {
      const m = object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
      m.updateMatrix();
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      g.deleteAttribute("uv");
      const finish = m.material.userData.finish as Finish;
      const list = batches.get(finish) ?? [];
      list.push(g);
      batches.set(finish, list);
      m.geometry.dispose();
      m.material.dispose();
    });
    const merged: T.Object3D[] = [];
    batches.forEach((geometries, finish) => {
      const geometry = mergeGeometries(geometries, false);
      if (!geometry) throw new Error(`Unable to build ${id}`);
      merged.push(mesh(geometry, finish));
      geometries.forEach((g) => g.dispose());
    });
    const group = new T.Group();
    group.name = id;
    group.add(...merged);
    group.userData.partId = id;
    const bounds = new T.Box3().setFromObject(group),
      center = bounds.getCenter(new T.Vector3()),
      size = bounds.getSize(new T.Vector3());
    // Recenter each assembly so exploded inventory cells preserve its geometry.
    merged.forEach((o) => o.position.sub(center));
    group.position.copy(center);
    components.push({
      part: {
        id,
        name,
        system,
        description,
        role,
        material,
        location,
        related,
        source,
      },
      group,
      center,
      size,
    });
  }
  add(
    "front-wing-mainplane",
    "Front wing mainplane",
    "aero",
    "The first major aerodynamic surface to meet the air. Its inverted wing profile produces front downforce and helps set the flow that reaches the wheels and floor. Changing the wing balance changes how the car responds on corner entry.",
    "Front downforce",
    "Carbon fibre composite",
    "Front axle, ahead of the wheels",
    [wing(-2.27, 0.22, 1.94, 0.36, "paint")],
    ["front-wing-flaps", "nose", "floor"],
    "car",
  );
  add(
    "front-wing-flaps",
    "Front wing flaps",
    "aero",
    "These smaller elements work with the mainplane. Slots between the elements let the wing sustain a larger pressure difference. Mechanics adjust flap angle to change the aerodynamic balance between the front and rear axles.",
    "Aero balance adjustment",
    "Carbon fibre composite",
    "Trailing edge of the front wing",
    [
      wing(-2.02, 0.27, 1.9, 0.17, "carbon"),
      wing(-1.87, 0.33, 1.87, 0.14, "paint"),
      wing(-1.75, 0.4, 1.82, 0.12, "carbon"),
    ],
    ["front-wing-mainplane", "rear-wing-mainplane"],
  );
  for (const side of [-1, 1]) {
    const label = side === 1 ? "Left" : "Right",
      key = side === 1 ? "left" : "right";
    add(
      `front-endplate-${key}`,
      `${label} front wing endplate`,
      "aero",
      "The endplate connects the wing elements at their outer edge. Its shape influences the interaction between the front wing and the turbulent wake of the rotating front tyre.",
      "Manage front wheel wake",
      "Carbon fibre composite",
      "Outer front wing",
      [
        loft(
          [
            [-2.43, 0.27, 0.08, 0.015],
            [-2.25, 0.32, 0.16, 0.02],
            [-1.8, 0.4, 0.2, 0.02],
            [-1.65, 0.45, 0.13, 0.015],
          ],
          "paint",
          side * 0.96,
        ),
      ],
      ["front-wing-mainplane"],
      "car",
    );
    add(
      `sidepod-${key}`,
      `${label} sidepod bodywork`,
      "body",
      "This outer shell guides air around the cooling installation. The inlet admits cooling air while the undercut and sloping upper surface shape the external flow towards the rear of the car. Internal heat exchangers are modeled separately.",
      "Package cooling and guide airflow",
      "Carbon fibre composite",
      "Alongside the cockpit and engine",
      [
        loft(
          [
            [-0.45, 0.53, 0.09, 0.2],
            [-0.23, 0.58, 0.19, 0.3],
            [0.2, 0.56, 0.21, 0.3],
            [0.65, 0.43, 0.13, 0.25],
            [1.14, 0.32, 0.065, 0.14],
            [1.35, 0.3, 0.03, 0.05],
          ],
          "paint",
          side * 0.49,
        ),
        box(
          [0.045, 0.13, 0.32],
          [-0.465, 0.55, side * 0.49],
          "dark",
          [0, 0, -0.18],
        ),
      ],
      ["radiator-" + key, "floor", "engine-cover"],
    );
    add(
      `floor-fences-${key}`,
      `${label} floor inlet fences`,
      "aero",
      "These vertical guides condition the air entering the underfloor. They help control flow direction and the interaction between the front wheel wake and the floor tunnels. Their exact arrangement varies between teams.",
      "Condition underfloor flow",
      "Carbon fibre composite",
      "Leading edge of the floor",
      [-0.21, -0.04, 0.14].map((offset) =>
        box(
          [0.43, 0.13, 0.012],
          [-0.64, 0.2, side * (0.51 + offset)],
          "carbon",
          [0, side * 0.18, 0],
        ),
      ),
      ["floor", "diffuser"],
      "car",
    );
    add(
      `floor-edge-${key}`,
      `${label} floor edge wing`,
      "aero",
      "A narrow surface along the outer floor edge helps control the flow where the low-pressure underfloor meets the air outside the car. Floor performance is sensitive to ride height and to this edge flow.",
      "Control floor edge flow",
      "Carbon fibre composite",
      "Outer floor edge",
      [
        box(
          [1.8, 0.026, 0.08],
          [0.35, 0.17, side * 0.87],
          "carbon",
          [0, 0, -0.025],
        ),
      ],
      ["floor", "floor-fences-" + key],
    );
  }
  add(
    "nose",
    "Nose cone",
    "body",
    "The long nose links the front wing to the chassis and contains the frontal impact structure. Its external shape must also deliver useful airflow to the suspension and the floor inlet.",
    "Front impact structure and aero surface",
    "Carbon fibre composite",
    "Front of the survival cell",
    [
      loft(
        [
          [-2.28, 0.32, 0.045, 0.065],
          [-2.02, 0.4, 0.07, 0.095],
          [-1.63, 0.5, 0.1, 0.13],
          [-1.2, 0.54, 0.16, 0.22],
          [-0.86, 0.54, 0.18, 0.25],
        ],
        "paint",
      ),
    ],
    ["monocoque", "front-wing-mainplane"],
  );
  add(
    "floor",
    "Ground-effect floor",
    "aero",
    "The shaped underside accelerates air beneath the car and produces a low-pressure region. In the 2022–2025 generation, long underfloor tunnels are central to downforce production. This simplified shell suggests those channels rather than reproducing a team’s floor design.",
    "Underbody downforce",
    "Carbon fibre composite",
    "Beneath the chassis and power unit",
    [
      box([2.85, 0.065, 1.68], [0.31, 0.105, 0]),
      ...[-1, 1].map((s) =>
        loft(
          [
            [-1.05, 0.14, 0.065, 0.34],
            [-0.45, 0.105, 0.045, 0.34],
            [0.5, 0.12, 0.055, 0.34],
            [1.5, 0.23, 0.11, 0.34],
          ],
          "carbon",
          s * 0.45,
        ),
      ),
    ],
    ["diffuser", "floor-fences-left", "floor-fences-right"],
    "car",
  );
  add(
    "diffuser",
    "Rear diffuser",
    "aero",
    "The diffuser expands the underfloor flow towards the rear of the car. A controlled expansion recovers pressure and helps the floor sustain a high mass flow. Its performance is closely coupled to the floor, rear ride height, and rear wing.",
    "Expand underfloor airflow",
    "Carbon fibre composite",
    "Under the gearbox, between the rear wheels",
    [
      box([0.64, 0.04, 1.36], [1.64, 0.24, 0], "carbon", [0, 0, 0.22]),
      ...[-0.58, -0.3, 0, 0.3, 0.58].map((z) =>
        box([0.61, 0.14, 0.012], [1.62, 0.18, z], "carbon", [0, 0, 0.15]),
      ),
    ],
    ["floor", "beam-wing"],
    "car",
  );
  add(
    "rear-wing-mainplane",
    "Rear wing mainplane",
    "aero",
    "The main rear wing generates load over the rear axle. More wing generally adds downforce and drag, so teams choose a configuration to suit the circuit. Its tips help shape the wake leaving the car.",
    "Rear downforce",
    "Carbon fibre composite",
    "Above the rear axle",
    [wing(1.98, 0.96, 1.2, 0.38, "paint", 0.02, 0.11)],
    ["rear-wing-flap", "rear-endplates", "beam-wing"],
    "car",
  );
  add(
    "rear-wing-flap",
    "Rear wing DRS flap",
    "aero",
    "This upper element can open in designated DRS zones under the rules of the 2022–2025 era. Opening the gap reduces rear-wing drag. The flap returns to its closed position for braking and cornering.",
    "Variable rear-wing drag",
    "Carbon fibre composite",
    "Upper rear wing",
    [wing(2.17, 1.14, 1.16, 0.24, "carbon", 0.015, 0.035)],
    ["rear-wing-mainplane", "drs-actuator"],
    "car",
  );
  add(
    "rear-endplates",
    "Rear wing endplates",
    "aero",
    "These side structures join the rear wing elements. The curved transition between the mainplane and tips is a recognizable feature of this generation and helps control the rear aerodynamic wake.",
    "Connect rear wing elements",
    "Carbon fibre composite",
    "Outer rear wing",
    [-1, 1].map((s) =>
      loft(
        [
          [1.76, 0.93, 0.16, 0.025],
          [1.97, 1.05, 0.22, 0.025],
          [2.27, 1.09, 0.16, 0.02],
        ],
        "paint",
        s * 0.61,
      ),
    ),
    ["rear-wing-mainplane"],
    "car",
  );
  add(
    "beam-wing",
    "Beam wing",
    "aero",
    "The lower rear wing sits above the diffuser exit. Its flow interacts with the diffuser and upper wing, helping the rear aerodynamic package work as a system.",
    "Support rear aero extraction",
    "Carbon fibre composite",
    "Below the main rear wing",
    [
      wing(1.99, 0.49, 1.18, 0.23, "carbon", 0, 0.03),
      wing(2.15, 0.59, 1.15, 0.16, "carbon", 0, 0.02),
    ],
    ["diffuser", "rear-wing-mainplane"],
  );
  add(
    "rear-wing-pylons",
    "Rear wing supports",
    "body",
    "Slender supports transfer aerodynamic forces from the rear wing into the rear structure. Their section also matters aerodynamically because they sit in the flow feeding the wing.",
    "Carry rear-wing loads",
    "Composite and metal fittings",
    "Behind the gearbox",
    [-0.1, 0.1].map((z) =>
      box([0.075, 0.68, 0.025], [1.94, 0.65, z], "carbon", [0, 0, -0.12]),
    ),
    ["rear-wing-mainplane", "gearbox"],
  );
  add(
    "drs-actuator",
    "DRS actuator",
    "power",
    "A compact actuator operates the rear wing flap through a linkage. It is modeled as a separate unit so the drag-reduction mechanism can be inspected without the surrounding wing.",
    "Move the rear wing flap",
    "Metal and composite housing",
    "Centre of the rear wing",
    [
      box([0.26, 0.065, 0.06], [2.05, 1.18, 0], "metal"),
      rod([2.03, 1.17, 0], [2.21, 1.22, 0], 0.012, "metal"),
    ],
    ["rear-wing-flap"],
  );
  add(
    "monocoque",
    "Survival cell / monocoque",
    "chassis",
    "The carbon-fibre survival cell surrounds the driver and fuel tank. It carries the front suspension loads and joins the engine at the rear. The open cockpit is represented by separate side walls and a lower shell.",
    "Driver protection and structural core",
    "Carbon fibre sandwich composite",
    "Centre of the car",
    [
      loft(
        [
          [-1.3, 0.37, 0.12, 0.2],
          [-0.9, 0.36, 0.17, 0.29],
          [0.6, 0.34, 0.18, 0.31],
          [0.75, 0.36, 0.14, 0.28],
        ],
        "carbon",
      ),
      ...[-1, 1].map((s) =>
        loft(
          [
            [-0.94, 0.5, 0.12, 0.065],
            [-0.6, 0.54, 0.15, 0.065],
            [0.2, 0.57, 0.17, 0.065],
            [0.55, 0.53, 0.16, 0.07],
          ],
          "paint",
          s * 0.275,
        ),
      ),
    ],
    ["halo", "fuel-cell", "seat"],
  );
  add(
    "halo",
    "Halo",
    "chassis",
    "The titanium halo forms a protective structure around the cockpit opening. A forward pillar and two rear attachment points transfer loads into the survival cell. A thin aerodynamic fairing covers the structural member.",
    "Cockpit head protection",
    "Titanium with composite fairing",
    "Around the cockpit opening",
    [
      tube(
        [
          [0.32, 0.77, -0.27],
          [-0.29, 0.82, -0.29],
          [-0.65, 0.82, 0],
          [-0.29, 0.82, 0.29],
          [0.32, 0.77, 0.27],
        ],
        0.03,
        "carbon",
      ),
      rod([-0.65, 0.8, 0], [-0.74, 0.55, 0], 0.029, "carbon"),
      rod([0.32, 0.77, -0.27], [0.4, 0.52, -0.27], 0.03),
      rod([0.32, 0.77, 0.27], [0.4, 0.52, 0.27], 0.03),
    ],
    ["monocoque", "roll-hoop"],
  );
  add(
    "seat",
    "Driver seat",
    "chassis",
    "The driver sits in a molded seat fitted inside the survival cell, with legs extending forward. The removable seat and its attachment provisions form part of the car’s safety installation.",
    "Support the driver",
    "Composite shell and padding",
    "Inside the cockpit",
    [
      box([0.47, 0.045, 0.34], [-0.22, 0.39, 0], "dark", [0, 0, -0.13]),
      box([0.07, 0.34, 0.34], [0.06, 0.53, 0], "dark", [0, 0, 0.32]),
    ],
    ["monocoque", "harness"],
  );
  add(
    "harness",
    "Safety harness",
    "chassis",
    "The multi-point harness restrains the driver in the seat. Belts attach to the survival cell and are arranged around the driver’s shoulders and pelvis.",
    "Restrain the driver",
    "Woven synthetic webbing",
    "Driver seat",
    [-0.09, 0.09].flatMap((z) => [
      box([0.045, 0.3, 0.025], [0.005, 0.57, z], "red", [0, 0, 0.33]),
      box([0.3, 0.018, 0.035], [-0.22, 0.43, z], "red"),
    ]),
    ["seat", "monocoque"],
  );
  add(
    "steering-wheel",
    "Steering wheel",
    "chassis",
    "The removable steering wheel combines steering input with switches, a display, and shift paddles. Drivers use its controls to change settings while keeping their hands close to the grips.",
    "Driver controls",
    "Carbon fibre, electronics and rubber",
    "Ahead of the driver",
    [
      box([0.05, 0.14, 0.25], [-0.57, 0.61, 0], "carbon", [0, 0, -0.22]),
      box([0.007, 0.07, 0.1], [-0.6, 0.63, 0], "metal"),
      ...[-1, 1].map((s) =>
        box([0.055, 0.18, 0.035], [-0.57, 0.6, s * 0.14], "dark"),
      ),
    ],
    ["steering-rack", "monocoque"],
  );
  add(
    "roll-hoop",
    "Roll hoop & air intake",
    "chassis",
    "The primary roll structure behind the driver supports the car in rollover conditions. The air intake around this area routes air towards the engine. Here, the support and inlet are grouped as one assembly.",
    "Rollover protection and engine intake",
    "Composite structure and metal inserts",
    "Behind the driver’s head",
    [
      loft(
        [
          [0.22, 0.86, 0.15, 0.12],
          [0.38, 0.84, 0.2, 0.14],
          [0.62, 0.74, 0.16, 0.12],
        ],
        "paint",
      ),
      box([0.018, 0.13, 0.14], [0.21, 0.9, 0], "dark"),
    ],
    ["halo", "engine-cover", "engine"],
  );
  add(
    "engine-cover",
    "Engine cover",
    "body",
    "Removable bodywork covers the engine and blends into the narrow rear of the car. It helps manage external airflow and provides a path for hot air to leave the power-unit installation. Hide the bodywork layer to inspect the machinery beneath it.",
    "Enclose the power unit",
    "Carbon fibre composite",
    "Behind the cockpit",
    [
      loft(
        [
          [0.38, 0.64, 0.24, 0.24],
          [0.62, 0.64, 0.27, 0.26],
          [0.96, 0.52, 0.22, 0.21],
          [1.3, 0.41, 0.15, 0.14],
          [1.68, 0.34, 0.06, 0.07],
        ],
        "paint",
      ),
      box([0.85, 0.15, 0.018], [0.96, 0.77, 0], "paint", [0, 0, -0.2]),
    ],
    ["engine", "turbo", "gearbox"],
  );
  add(
    "fuel-cell",
    "Fuel cell",
    "chassis",
    "A flexible safety bladder holds the fuel inside the survival cell, behind the driver and ahead of the engine. Its placement keeps the fuel protected within the central structure.",
    "Store fuel",
    "Reinforced flexible bladder",
    "Behind the driver",
    [box([0.28, 0.36, 0.4], [0.33, 0.37, 0], "gold")],
    ["monocoque", "engine"],
  );
  add(
    "engine",
    "1.6-litre V6 engine",
    "power",
    "The turbocharged internal combustion engine converts fuel energy into mechanical work. Its V6 layout forms part of the hybrid power unit and acts as a structural connection between the survival cell and gearbox. The block and cylinder banks are represented schematically.",
    "Combustion power",
    "Metal alloys",
    "Behind the fuel cell",
    [
      box([0.6, 0.23, 0.32], [0.83, 0.32, 0], "metal"),
      ...[-1, 1].map((s) =>
        box([0.56, 0.15, 0.22], [0.83, 0.48, s * 0.16], "metal", [
          s * 0.52,
          0,
          0,
        ]),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        box([0.055, 0.025, 0.5], [0.59 + i * 0.09, 0.52, 0], "carbon"),
      ),
    ],
    ["turbo", "mgu-k", "gearbox"],
    "car",
  );
  add(
    "turbo",
    "Turbocharger",
    "power",
    "Exhaust gas drives a turbine connected to a compressor. The compressor raises the pressure of incoming air before it enters the engine. This model groups the compressor and turbine into a simplified rear-mounted unit; team layouts vary.",
    "Compress intake air",
    "Heat-resistant metal alloys",
    "At the rear of the engine",
    [
      mesh(
        new T.TorusGeometry(0.095, 0.04, 12, 32),
        "metal",
        [1.2, 0.48, 0],
        [Math.PI / 2, 0, 0],
      ),
      rod([1.08, 0.48, 0], [1.32, 0.48, 0], 0.046, "metal"),
    ],
    ["engine", "mgu-h", "exhaust"],
  );
  add(
    "mgu-h",
    "MGU-H",
    "power",
    "The motor generator unit on the turbocharger shaft can recover exhaust energy and control turbo speed. It belongs to the 2014–2025 hybrid architecture represented here. It is not part of the 2026 power-unit rules.",
    "Recover turbo-shaft energy",
    "Electrical machine",
    "Along the turbocharger shaft",
    [rod([1.05, 0.5, 0], [1.14, 0.5, 0], 0.065, "gold")],
    ["turbo", "energy-store"],
  );
  add(
    "mgu-k",
    "MGU-K",
    "power",
    "The kinetic motor generator is mechanically connected to the engine drivetrain. It recovers energy during braking and can return electrical energy as driving torque. The 2022–2025 rules limit its power to 120 kW.",
    "Recover and deliver drivetrain energy",
    "Electrical machine",
    "Beside the engine",
    [rod([0.57, 0.26, -0.28], [0.91, 0.26, -0.28], 0.07, "gold")],
    ["engine", "energy-store", "control-electronics"],
  );
  add(
    "energy-store",
    "Energy store",
    "power",
    "The high-voltage battery stores electrical energy for the hybrid system. It exchanges energy with the motor generators through power electronics. Its enclosure sits within the protected central part of the car.",
    "Store electrical energy",
    "Battery cells and protective enclosure",
    "Low in the survival cell",
    [box([0.48, 0.095, 0.32], [0.13, 0.19, 0], "gold")],
    ["mgu-k", "mgu-h", "control-electronics"],
  );
  add(
    "control-electronics",
    "Control electronics",
    "power",
    "Power electronics manage electrical energy between the battery and motor generators. Control systems coordinate the hybrid system with the engine and the driver’s requests.",
    "Manage hybrid energy flow",
    "Electronic modules",
    "Beside the energy store",
    [box([0.27, 0.06, 0.14], [0.07, 0.26, -0.19], "metal")],
    ["energy-store", "mgu-k"],
  );
  add(
    "gearbox",
    "Gearbox & differential",
    "power",
    "The eight-speed gearbox transfers engine torque to the rear wheels. The differential allows the rear wheels to turn at different speeds in a corner. The casing also supports rear suspension attachments.",
    "Transmit drive to the rear axle",
    "Metal gears and structural casing",
    "Behind the engine",
    [
      loft(
        [
          [1.13, 0.33, 0.16, 0.18],
          [1.4, 0.33, 0.14, 0.14],
          [1.77, 0.33, 0.11, 0.16],
          [1.93, 0.32, 0.07, 0.11],
        ],
        "metal",
      ),
      rod([1.62, 0.34, -0.23], [1.62, 0.34, 0.23], 0.1, "metal"),
    ],
    ["engine", "driveshaft-left", "driveshaft-right"],
  );
  add(
    "exhaust",
    "Exhaust system",
    "power",
    "Exhaust runners collect gas from the cylinders and feed the turbo turbine. The tailpipe releases the gas at the rear. The schematic pipes show the route without reproducing the tuned lengths used by a team.",
    "Route exhaust gas",
    "Heat-resistant alloy",
    "Engine banks to rear outlet",
    [-1, 1]
      .map((s) =>
        tube(
          [
            [0.69, 0.47, s * 0.27],
            [0.9, 0.38, s * 0.3],
            [1.17, 0.45, s * 0.13],
            [1.32, 0.48, 0],
          ],
          0.033,
          "gold",
        ),
      )
      .concat([rod([1.29, 0.48, 0], [2.05, 0.46, 0], 0.045, "gold")]),
    ["turbo", "engine"],
  );
  for (const side of [-1, 1]) {
    const label = side === 1 ? "Left" : "Right",
      key = side === 1 ? "left" : "right";
    add(
      `radiator-${key}`,
      `${label} radiator assembly`,
      "cooling",
      "Heat exchangers transfer heat from circulating fluids into air passing through the sidepod. The two sides may contain different radiator and charge-air cooling arrangements on a real car. The repeated fins here identify the heat-exchanger core.",
      "Reject power-unit heat",
      "Aluminium heat exchanger",
      "Inside the sidepod",
      [
        box([0.65, 0.24, 0.055], [0.22, 0.46, side * 0.49], "metal", [
          side * 0.55,
          0,
          0,
        ]),
        ...Array.from({ length: 14 }, (_, i) =>
          box(
            [0.016, 0.235, 0.06],
            [-0.08 + i * 0.046, 0.46, side * 0.49],
            "carbon",
            [side * 0.55, 0, 0],
          ),
        ),
      ],
      ["sidepod-" + key, "engine"],
    );
    add(
      `coolant-pipes-${key}`,
      `${label} cooling pipes`,
      "cooling",
      "Pipes circulate coolant between the power unit and heat exchangers. Their routing must fit tightly around structural members, hot exhaust parts, and the sidepod bodywork.",
      "Circulate coolant",
      "Metal and reinforced hose",
      "Between engine and sidepod",
      [
        tube(
          [
            [0.45, 0.33, side * 0.24],
            [0.55, 0.35, side * 0.48],
            [0.3, 0.4, side * 0.61],
            [-0.03, 0.4, side * 0.55],
          ],
          0.022,
          "metal",
        ),
      ],
      ["radiator-" + key, "engine"],
    );
    add(
      `mirror-${key}`,
      `${label} rear-view mirror`,
      "body",
      "Mirrors provide the driver with a rearward view. Their small housings and supports also sit in an aerodynamically sensitive area near the cockpit and sidepod inlet.",
      "Rearward visibility",
      "Composite housing and reflective glass",
      "Alongside the cockpit",
      [
        rod([-0.45, 0.61, side * 0.29], [-0.39, 0.72, side * 0.54], 0.012),
        box([0.13, 0.065, 0.16], [-0.39, 0.73, side * 0.54], "paint"),
        box([0.008, 0.045, 0.12], [-0.32, 0.73, side * 0.54], "metal"),
      ],
      ["monocoque"],
    );
    add(
      `driveshaft-${key}`,
      `${label} rear driveshaft`,
      "power",
      "The driveshaft transmits torque from the differential to the rear wheel hub. Joints accommodate suspension movement while maintaining the drive connection.",
      "Transmit wheel torque",
      "High-strength metal",
      "Differential to rear wheel",
      [
        rod(
          [1.62, 0.34, side * 0.13],
          [1.62, 0.34, side * 0.86],
          0.024,
          "metal",
        ),
      ],
      ["gearbox", `wheel-rear-${key}`],
    );
  }
  add(
    "steering-rack",
    "Steering rack",
    "suspension",
    "The rack converts steering-column rotation into lateral movement. Track rods carry that movement to the front uprights to change the angle of the front wheels.",
    "Convert steering input",
    "Metal rack and pinion",
    "Inside the front chassis",
    [rod([-1.3, 0.38, -0.27], [-1.3, 0.38, 0.27], 0.045, "metal")],
    ["steering-wheel", "trackrod-front-left", "trackrod-front-right"],
  );
  for (const axle of ["front", "rear"] as const)
    for (const side of [-1, 1]) {
      const x = axle === "front" ? -1.48 : 1.62,
        z = side * 0.84,
        label = `${side === 1 ? "Left" : "Right"} ${axle}`,
        key = `${axle}-${side === 1 ? "left" : "right"}`,
        rear = axle === "rear",
        width = rear ? 0.39 : 0.31;
      add(
        `tyre-${key}`,
        `${label} slick tyre`,
        "wheels",
        "The slick tyre is the car’s contact with the track. Its rubber compound and temperature determine how much grip is available. The 2022–2025 generation uses low-profile tyres on 18-inch rims. This model shows dry-weather slicks.",
        "Mechanical grip",
        "Racing tyre rubber",
        `${label} corner`,
        [
          mesh(
            new T.CylinderGeometry(0.36, 0.36, width, 64, 1, true),
            "rubber",
            [x, 0.36, z],
            [Math.PI / 2, 0, 0],
          ),
          ring(0.292, 0.067, [x, 0.36, z - width / 2 + 0.035], "rubber"),
          ring(0.292, 0.067, [x, 0.36, z + width / 2 - 0.035], "rubber"),
          ring(0.294, 0.006, [x, 0.36, z + side * (width / 2 + 0.002)], "gold"),
        ],
        [`wheel-${key}`, `brake-${key}`],
        "car",
      );
      add(
        `wheel-${key}`,
        `${label} wheel & cover`,
        "wheels",
        "The wheel supports the tyre and connects to the upright through its hub. An outer cover controls airflow through the wheel. A single central nut secures the wheel during a pit stop.",
        "Support the tyre",
        "Magnesium alloy and composite cover",
        `${label} hub`,
        [
          mesh(
            new T.CylinderGeometry(0.227, 0.227, width - 0.025, 48),
            "carbon",
            [x, 0.36, z],
            [Math.PI / 2, 0, 0],
          ),
          ring(0.222, 0.008, [x, 0.36, z + (side * width) / 2], "metal"),
          mesh(
            new T.CylinderGeometry(0.042, 0.042, 0.025, 6),
            "gold",
            [x, 0.36, z + side * (width / 2 + 0.016)],
            [Math.PI / 2, 0, 0],
          ),
          ...Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return rod(
              [
                x + Math.cos(a) * 0.06,
                0.36 + Math.sin(a) * 0.06,
                z + (side * width) / 2,
              ],
              [
                x + Math.cos(a) * 0.19,
                0.36 + Math.sin(a) * 0.19,
                z + (side * width) / 2,
              ],
              0.005,
              "metal",
            );
          }),
        ],
        [`tyre-${key}`, `upright-${key}`],
        "car",
      );
      add(
        `brake-${key}`,
        `${label} brake disc & caliper`,
        "brakes",
        "The caliper squeezes pads against the rotating carbon disc, converting motion into heat. Brake ducts manage cooling. At the rear, the braking system also coordinates friction braking with hybrid energy recovery.",
        "Slow the wheel",
        "Carbon-carbon disc and metal caliper",
        `Inside the ${label.toLowerCase()} wheel`,
        [
          mesh(
            new T.CylinderGeometry(0.155, 0.155, 0.024, 48),
            "metal",
            [x, 0.36, z - side * 0.07],
            [Math.PI / 2, 0, 0],
          ),
          box([0.075, 0.17, 0.085], [x + 0.12, 0.36, z - side * 0.07], "gold"),
        ],
        [`brake-duct-${key}`, `wheel-${key}`],
      );
      add(
        `brake-duct-${key}`,
        `${label} brake duct`,
        "brakes",
        "The inlet feeds cooling air towards the disc and caliper. Duct shape and internal passages balance cooling demand with aerodynamic effects around the wheel.",
        "Cool the brake assembly",
        "Carbon fibre composite",
        `Inboard of the ${label.toLowerCase()} wheel`,
        [
          box([0.16, 0.12, 0.06], [x - 0.07, 0.43, z - side * 0.2], "carbon"),
          rod(
            [x - 0.07, 0.43, z - side * 0.2],
            [x, 0.37, z - side * 0.08],
            0.039,
            "carbon",
          ),
        ],
        [`brake-${key}`],
      );
      add(
        `upright-${key}`,
        `${label} upright`,
        "suspension",
        "The upright carries the wheel bearing and joins the suspension links to the hub. It transfers tyre forces into the suspension while allowing the wheel to rotate. Front uprights also pivot for steering.",
        "Locate the wheel hub",
        "High-strength metal",
        `${label} wheel centre`,
        [
          box([0.075, 0.25, 0.055], [x, 0.36, z - side * 0.13], "metal"),
          rod([x, 0.36, z - side * 0.16], [x, 0.36, z], 0.045, "metal"),
        ],
        [`wishbone-upper-${key}`, `wishbone-lower-${key}`, `wheel-${key}`],
      );
      for (const level of ["upper", "lower"] as const) {
        const y = level === "upper" ? 0.49 : 0.23,
          innerX = x + (rear ? -0.17 : 0.22);
        add(
          `wishbone-${level}-${key}`,
          `${label} ${level} wishbone`,
          "suspension",
          "Two legs form a triangular link between the chassis and upright. Upper and lower wishbones control wheel motion and camber as the suspension moves. Their slender fairings reduce aerodynamic disturbance.",
          "Guide wheel travel",
          "Composite links with metal joints",
          `${label} suspension`,
          [
            rod(
              [innerX - 0.26, y, side * 0.2],
              [x, y - 0.015, z - side * 0.12],
              0.014,
            ),
            rod(
              [innerX + 0.26, y, side * 0.2],
              [x, y - 0.015, z - side * 0.12],
              0.014,
            ),
          ],
          [`upright-${key}`, `pushrod-${key}`],
        );
      }
      add(
        `pushrod-${key}`,
        `${label} pushrod`,
        "suspension",
        "This diagonal member transfers wheel movement to an inboard rocker and spring-damper assembly. The generic model uses a pushrod arrangement. Actual teams choose pushrod or pullrod layouts for their packaging and aerodynamic needs.",
        "Actuate inboard suspension",
        "Composite rod with metal ends",
        `${label} suspension`,
        [
          rod(
            [x, 0.23, z - side * 0.13],
            [x + (rear ? -0.15 : 0.3), 0.61, side * 0.18],
            0.017,
            "metal",
          ),
        ],
        [`damper-${axle}`, `upright-${key}`],
      );
      if (!rear) {
        add(
          `trackrod-${key}`,
          `${label} steering track rod`,
          "suspension",
          "The track rod links the steering rack to the upright. Movement from the rack turns the front wheel. Its length and attachment geometry help set the steering response and toe.",
          "Steer the front wheel",
          "Metal and composite",
          `${label} suspension`,
          [
            rod(
              [-1.3, 0.38, side * 0.23],
              [-1.38, 0.36, z - side * 0.13],
              0.012,
              "metal",
            ),
          ],
          ["steering-rack", `upright-${key}`],
        );
        add(
          `wheel-winglet-${key}`,
          `${label} wheel winglet`,
          "aero",
          "A small fairing above the front tyre helps manage the wheel wake. These over-wheel devices were introduced with the 2022 car generation.",
          "Condition front tyre wake",
          "Carbon fibre composite",
          `Above the ${label.toLowerCase()} tyre`,
          [
            tube(
              [
                [x - 0.23, 0.67, z - side * 0.05],
                [x - 0.06, 0.755, z - side * 0.05],
                [x + 0.18, 0.705, z - side * 0.05],
              ],
              0.022,
              "carbon",
            ),
            rod([x, 0.56, z - side * 0.19], [x, 0.73, z - side * 0.05], 0.012),
          ],
          [`tyre-${key}`],
          "car",
        );
      }
    }
  for (const axle of ["front", "rear"] as const) {
    const x = axle === "front" ? -1.15 : 1.48;
    add(
      `damper-${axle}`,
      `${axle === "front" ? "Front" : "Rear"} inboard dampers`,
      "suspension",
      "Inboard spring and damper elements support the car and control the rate of suspension movement. Rockers transfer forces from the outboard rods. Their setup is especially important for controlling the ride height of a ground-effect car.",
      "Control body movement",
      "Metal springs and hydraulic dampers",
      `${axle} inboard suspension`,
      [-1, 1].flatMap((s) => [
        rod(
          [x - 0.12, 0.5, s * 0.13],
          [x + 0.12, 0.5, s * 0.13],
          0.032,
          "metal",
        ),
        ...Array.from({ length: 7 }, (_, i) =>
          mesh(
            new T.TorusGeometry(0.039, 0.007, 6, 12),
            "gold",
            [x - 0.1 + i * 0.03, 0.5, s * 0.13],
            [0, Math.PI / 2, 0],
          ),
        ),
      ]),
      [`pushrod-${axle}-left`, `pushrod-${axle}-right`],
    );
  }
  add(
    "rear-impact",
    "Rear impact structure & rain light",
    "chassis",
    "The rear crash structure absorbs energy in a rear impact. The red rear light improves visibility in poor conditions and can also indicate energy recovery behavior. They are grouped here as a rear safety assembly.",
    "Impact absorption and visibility",
    "Composite crash structure and LED light",
    "Rear of the gearbox",
    [
      loft(
        [
          [1.8, 0.28, 0.07, 0.1],
          [2.15, 0.27, 0.04, 0.05],
        ],
        "carbon",
      ),
      box([0.035, 0.07, 0.075], [2.18, 0.27, 0], "red"),
    ],
    ["gearbox"],
  );
  return components;
}
