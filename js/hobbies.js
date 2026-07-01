const mindmap = document.querySelector("#hobbyMindmap");
const lineSvg = document.querySelector("#mindmapLines");
const centerNode = document.querySelector("#mindmapCenter");

const draggableNodes = [
  ...document.querySelectorAll(".mindmap-draggable")
];

const resetButton = document.querySelector("#mindmapReset");
const placeholder = document.querySelector("#hobbyPlaceholder");

const panels = [
  ...document.querySelectorAll(".hobby-detail-panel")
];

const closeButtons = [
  ...document.querySelectorAll(".hobby-detail-close")
];

const desktopQuery = window.matchMedia("(min-width: 951px)");

const DRAG_THRESHOLD = 6;
const WALL_BOUNCE = 0.72;
const NODE_BOUNCE = 0.72;
const BORDER_PADDING = 8;
const MAX_THROW_SPEED = 10;

/*
  Return behavior:
  Increase RETURN_STRENGTH to make nodes return faster.
  Lower VELOCITY_DAMPING to make nodes stop faster.
*/
const RETURN_STRENGTH = 0.00085;
const VELOCITY_DAMPING = 0.965;
const SNAP_DISTANCE = 1;
const SNAP_SPEED = 0.045;

let activeDrag = null;
let previousFrameTime = performance.now();
let animationFrameId = null;
let bodiesInitialized = false;

const bodies = new Map();

/* =========================================================
   HELPERS
========================================================= */

function clamp(value, minimum, maximum) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function getNodeCenter(node) {
  return {
    x: node.offsetLeft + node.offsetWidth / 2,
    y: node.offsetTop + node.offsetHeight / 2
  };
}

/* =========================================================
   PHYSICS SETUP
========================================================= */

function initializeBodies(forceReset = false) {
  if (!mindmap || !desktopQuery.matches) {
    return;
  }

  draggableNodes.forEach((node) => {
    const nodeId = node.dataset.nodeId;
    const existingBody = bodies.get(nodeId);

    const width = node.offsetWidth;
    const height = node.offsetHeight;

    if (existingBody && !forceReset) {
      existingBody.width = width;
      existingBody.height = height;

      /*
        Keep the main Hobbies node centered dynamically.
      */
      if (node === centerNode) {
        existingBody.homeX =
          (mindmap.clientWidth - width) / 2;

        existingBody.homeY =
          (mindmap.clientHeight - height) / 2;
      }

      return;
    }

    let startingX = node.offsetLeft;
    let startingY = node.offsetTop;

    /*
      Center the main node regardless of map width.
    */
    if (node === centerNode) {
      startingX =
        (mindmap.clientWidth - width) / 2;

      startingY =
        (mindmap.clientHeight - height) / 2;
    }

    bodies.set(nodeId, {
      node,

      x: startingX,
      y: startingY,

      homeX: startingX,
      homeY: startingY,

      width,
      height,

      vx: 0,
      vy: 0,

      mass: Math.max(
        0.7,
        (width * height) / 30000
      ),

      dragging: false
    });
  });

  bodiesInitialized = true;

  renderBodies();
  updateLines();
}

function renderBodies() {
  if (!desktopQuery.matches) {
    return;
  }

  bodies.forEach((body) => {
    body.node.style.left = `${body.x}px`;
    body.node.style.top = `${body.y}px`;
  });
}

/* =========================================================
   CONNECTION LINES
========================================================= */

function updateLines() {
  if (
    !mindmap ||
    !lineSvg ||
    !centerNode ||
    !desktopQuery.matches
  ) {
    return;
  }

  const width = mindmap.clientWidth;
  const height = mindmap.clientHeight;

  lineSvg.setAttribute(
    "viewBox",
    `0 0 ${width} ${height}`
  );

  const start = getNodeCenter(centerNode);

  lineSvg
    .querySelectorAll("line[data-target]")
    .forEach((line) => {
      const targetId = line.dataset.target;

      const target = mindmap.querySelector(
        `[data-node-id="${targetId}"]`
      );

      if (!target) {
        return;
      }

      const end = getNodeCenter(target);

      line.setAttribute("x1", start.x);
      line.setAttribute("y1", start.y);
      line.setAttribute("x2", end.x);
      line.setAttribute("y2", end.y);
    });
}

/* =========================================================
   WALL COLLISIONS
========================================================= */

function handleWallCollision(body) {
  const minimumX = BORDER_PADDING;
  const minimumY = BORDER_PADDING;

  const maximumX = Math.max(
    minimumX,
    mindmap.clientWidth -
      body.width -
      BORDER_PADDING
  );

  const maximumY = Math.max(
    minimumY,
    mindmap.clientHeight -
      body.height -
      BORDER_PADDING
  );

  if (body.x <= minimumX) {
    body.x = minimumX;
    body.vx =
      Math.abs(body.vx) * WALL_BOUNCE;
  }

  if (body.x >= maximumX) {
    body.x = maximumX;
    body.vx =
      -Math.abs(body.vx) * WALL_BOUNCE;
  }

  if (body.y <= minimumY) {
    body.y = minimumY;
    body.vy =
      Math.abs(body.vy) * WALL_BOUNCE;
  }

  if (body.y >= maximumY) {
    body.y = maximumY;
    body.vy =
      -Math.abs(body.vy) * WALL_BOUNCE;
  }
}

/* =========================================================
   NODE COLLISIONS
========================================================= */

function resolveNodeCollision(bodyA, bodyB) {
  const centerAX =
    bodyA.x + bodyA.width / 2;

  const centerAY =
    bodyA.y + bodyA.height / 2;

  const centerBX =
    bodyB.x + bodyB.width / 2;

  const centerBY =
    bodyB.y + bodyB.height / 2;

  const differenceX =
    centerBX - centerAX;

  const differenceY =
    centerBY - centerAY;

  const overlapX =
    bodyA.width / 2 +
    bodyB.width / 2 -
    Math.abs(differenceX);

  const overlapY =
    bodyA.height / 2 +
    bodyB.height / 2 -
    Math.abs(differenceY);

  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  const inverseMassA = bodyA.dragging
    ? 0
    : 1 / bodyA.mass;

  const inverseMassB = bodyB.dragging
    ? 0
    : 1 / bodyB.mass;

  const inverseMassTotal =
    inverseMassA + inverseMassB;

  if (inverseMassTotal === 0) {
    return;
  }

  if (overlapX < overlapY) {
    resolveHorizontalCollision(
      bodyA,
      bodyB,
      differenceX,
      overlapX,
      inverseMassA,
      inverseMassB,
      inverseMassTotal
    );
  } else {
    resolveVerticalCollision(
      bodyA,
      bodyB,
      differenceY,
      overlapY,
      inverseMassA,
      inverseMassB,
      inverseMassTotal
    );
  }
}

function resolveHorizontalCollision(
  bodyA,
  bodyB,
  differenceX,
  overlap,
  inverseMassA,
  inverseMassB,
  inverseMassTotal
) {
  const direction =
    differenceX >= 0 ? 1 : -1;

  const correction = overlap + 0.5;

  bodyA.x -=
    direction *
    correction *
    (inverseMassA / inverseMassTotal);

  bodyB.x +=
    direction *
    correction *
    (inverseMassB / inverseMassTotal);

  const relativeVelocity =
    (bodyB.vx - bodyA.vx) * direction;

  if (relativeVelocity >= 0) {
    return;
  }

  const impulse =
    -(
      (1 + NODE_BOUNCE) *
      relativeVelocity
    ) / inverseMassTotal;

  bodyA.vx -=
    impulse *
    inverseMassA *
    direction;

  bodyB.vx +=
    impulse *
    inverseMassB *
    direction;
}

function resolveVerticalCollision(
  bodyA,
  bodyB,
  differenceY,
  overlap,
  inverseMassA,
  inverseMassB,
  inverseMassTotal
) {
  const direction =
    differenceY >= 0 ? 1 : -1;

  const correction = overlap + 0.5;

  bodyA.y -=
    direction *
    correction *
    (inverseMassA / inverseMassTotal);

  bodyB.y +=
    direction *
    correction *
    (inverseMassB / inverseMassTotal);

  const relativeVelocity =
    (bodyB.vy - bodyA.vy) * direction;

  if (relativeVelocity >= 0) {
    return;
  }

  const impulse =
    -(
      (1 + NODE_BOUNCE) *
      relativeVelocity
    ) / inverseMassTotal;

  bodyA.vy -=
    impulse *
    inverseMassA *
    direction;

  bodyB.vy +=
    impulse *
    inverseMassB *
    direction;
}

function handleAllNodeCollisions() {
  const bodyList = [...bodies.values()];

  /*
    Multiple passes help separate overlapping nodes smoothly.
  */
  for (
    let iteration = 0;
    iteration < 2;
    iteration += 1
  ) {
    for (
      let firstIndex = 0;
      firstIndex < bodyList.length;
      firstIndex += 1
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < bodyList.length;
        secondIndex += 1
      ) {
        resolveNodeCollision(
          bodyList[firstIndex],
          bodyList[secondIndex]
        );
      }
    }
  }
}

/* =========================================================
   RETURN-TO-HOME ANIMATION
========================================================= */

function animate(timestamp) {
  animationFrameId =
    window.requestAnimationFrame(animate);

  if (
    !desktopQuery.matches ||
    !bodiesInitialized
  ) {
    previousFrameTime = timestamp;
    return;
  }

  const elapsedMilliseconds = Math.min(
    timestamp - previousFrameTime,
    32
  );

  const frameScale =
    elapsedMilliseconds / 16.6667;

  previousFrameTime = timestamp;

  bodies.forEach((body) => {
    if (body.dragging) {
      return;
    }

    /*
      Spring force pulls each node toward its original
      position.
    */
    const distanceFromHomeX =
      body.homeX - body.x;

    const distanceFromHomeY =
      body.homeY - body.y;

    body.vx +=
      distanceFromHomeX *
      RETURN_STRENGTH *
      frameScale;

    body.vy +=
      distanceFromHomeY *
      RETURN_STRENGTH *
      frameScale;

    /*
      Damping removes momentum until the node stops.
    */
    const damping = Math.pow(
      VELOCITY_DAMPING,
      frameScale
    );

    body.vx *= damping;
    body.vy *= damping;

    body.x += body.vx * frameScale;
    body.y += body.vy * frameScale;

    handleWallCollision(body);
  });

  handleAllNodeCollisions();

  bodies.forEach((body) => {
    handleWallCollision(body);

    if (body.dragging) {
      return;
    }

    const distanceFromHome = Math.hypot(
      body.homeX - body.x,
      body.homeY - body.y
    );

    const currentSpeed = Math.hypot(
      body.vx,
      body.vy
    );

    /*
      Snap the node exactly home once it is close enough
      and moving slowly enough.
    */
    if (
      distanceFromHome < SNAP_DISTANCE &&
      currentSpeed < SNAP_SPEED
    ) {
      body.x = body.homeX;
      body.y = body.homeY;
      body.vx = 0;
      body.vy = 0;
    }
  });

  renderBodies();
  updateLines();
}

/* =========================================================
   DRAGGING AND THROWING
========================================================= */

function startDrag(event, node) {
  if (
    !desktopQuery.matches ||
    event.button !== 0
  ) {
    return;
  }

  const body = bodies.get(
    node.dataset.nodeId
  );

  if (!body) {
    return;
  }

  activeDrag = {
    node,
    body,

    pointerId: event.pointerId,

    startPointerX: event.clientX,
    startPointerY: event.clientY,

    startLeft: body.x,
    startTop: body.y,

    lastPointerX: event.clientX,
    lastPointerY: event.clientY,
    lastPointerTime: performance.now(),

    throwVelocityX: body.vx,
    throwVelocityY: body.vy,

    moved: false
  };

  body.dragging = true;
  body.vx = 0;
  body.vy = 0;

  node.setPointerCapture(event.pointerId);
  node.classList.add("is-dragging");
}

function moveDrag(event) {
  if (
    !activeDrag ||
    event.pointerId !== activeDrag.pointerId
  ) {
    return;
  }

  const differenceX =
    event.clientX -
    activeDrag.startPointerX;

  const differenceY =
    event.clientY -
    activeDrag.startPointerY;

  const totalMovement = Math.hypot(
    differenceX,
    differenceY
  );

  if (totalMovement >= DRAG_THRESHOLD) {
    activeDrag.moved = true;
  }

  const maximumLeft =
    mindmap.clientWidth -
    activeDrag.body.width -
    BORDER_PADDING;

  const maximumTop =
    mindmap.clientHeight -
    activeDrag.body.height -
    BORDER_PADDING;

  activeDrag.body.x = clamp(
    activeDrag.startLeft + differenceX,
    BORDER_PADDING,
    maximumLeft
  );

  activeDrag.body.y = clamp(
    activeDrag.startTop + differenceY,
    BORDER_PADDING,
    maximumTop
  );

  const currentTime = performance.now();

  const elapsedTime = Math.max(
    currentTime -
      activeDrag.lastPointerTime,
    1
  );

  const frameDifference =
    elapsedTime / 16.6667;

  activeDrag.throwVelocityX = clamp(
    (
      event.clientX -
      activeDrag.lastPointerX
    ) / frameDifference,
    -MAX_THROW_SPEED,
    MAX_THROW_SPEED
  );

  activeDrag.throwVelocityY = clamp(
    (
      event.clientY -
      activeDrag.lastPointerY
    ) / frameDifference,
    -MAX_THROW_SPEED,
    MAX_THROW_SPEED
  );

  activeDrag.body.vx =
    activeDrag.throwVelocityX;

  activeDrag.body.vy =
    activeDrag.throwVelocityY;

  activeDrag.lastPointerX =
    event.clientX;

  activeDrag.lastPointerY =
    event.clientY;

  activeDrag.lastPointerTime =
    currentTime;

  handleAllNodeCollisions();
  renderBodies();
  updateLines();
}

function endDrag(event) {
  if (
    !activeDrag ||
    event.pointerId !== activeDrag.pointerId
  ) {
    return;
  }

  const draggedNode = activeDrag.node;
  const draggedBody = activeDrag.body;
  const nodeMoved = activeDrag.moved;

  draggedBody.dragging = false;

  if (nodeMoved) {
    draggedBody.vx =
      activeDrag.throwVelocityX * 0.92;

    draggedBody.vy =
      activeDrag.throwVelocityY * 0.92;
  } else {
    draggedBody.vx = 0;
    draggedBody.vy = 0;
  }

  draggedNode.classList.remove(
    "is-dragging"
  );

  try {
    draggedNode.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {
    /*
      The pointer may have already been released.
    */
  }

  draggedNode.dataset.justDragged =
    nodeMoved ? "true" : "false";

  activeDrag = null;

  window.setTimeout(() => {
    draggedNode.dataset.justDragged =
      "false";
  }, 0);
}

/* =========================================================
   DETAIL PANELS
========================================================= */

function closePanels() {
  panels.forEach((panel) => {
    panel.classList.remove("is-visible");
    panel.hidden = true;
  });

  draggableNodes.forEach((node) => {
    node.classList.remove("is-active");

    node.setAttribute(
      "aria-expanded",
      "false"
    );
  });

  if (placeholder) {
    placeholder.hidden = false;
  }
}

function openPanel(panelId, trigger) {
  const selectedPanel =
    document.querySelector(
      `[data-panel-id="${panelId}"]`
    );

  if (!selectedPanel) {
    return;
  }

  panels.forEach((panel) => {
    const isSelected =
      panel === selectedPanel;

    panel.hidden = !isSelected;

    panel.classList.toggle(
      "is-visible",
      isSelected
    );
  });

  draggableNodes.forEach((node) => {
    const isActive = node === trigger;

    node.classList.toggle(
      "is-active",
      isActive
    );

    node.setAttribute(
      "aria-expanded",
      String(isActive)
    );
  });

  if (placeholder) {
    placeholder.hidden = true;
  }

  if (!desktopQuery.matches) {
    selectedPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

/* =========================================================
   RESET
========================================================= */

function resetBodies() {
  bodies.forEach((body) => {
    /*
      Recalculate the center node's correct home position.
    */
    if (body.node === centerNode) {
      body.homeX =
        (mindmap.clientWidth -
          body.width) /
        2;

      body.homeY =
        (mindmap.clientHeight -
          body.height) /
        2;
    }

    body.x = body.homeX;
    body.y = body.homeY;

    body.vx = 0;
    body.vy = 0;

    body.dragging = false;
  });

  renderBodies();
  updateLines();
}

/* =========================================================
   RESIZING
========================================================= */

function handleResize() {
  if (!desktopQuery.matches) {
    return;
  }

  if (!bodiesInitialized) {
    initializeBodies();
    return;
  }

  bodies.forEach((body) => {
    body.width =
      body.node.offsetWidth;

    body.height =
      body.node.offsetHeight;

    /*
      Keep the main Hobbies node centered after resizing.
    */
    if (body.node === centerNode) {
      body.homeX =
        (mindmap.clientWidth -
          body.width) /
        2;

      body.homeY =
        (mindmap.clientHeight -
          body.height) /
        2;

      if (!body.dragging) {
        body.x = body.homeX;
        body.y = body.homeY;
        body.vx = 0;
        body.vy = 0;
      }
    }

    handleWallCollision(body);
  });

  renderBodies();
  updateLines();
}

function handleResponsiveChange(event) {
  if (event.matches) {
    window.requestAnimationFrame(() => {
      initializeBodies(!bodiesInitialized);
      handleResize();
    });
  }
}

/* =========================================================
   EVENTS
========================================================= */

draggableNodes.forEach((node) => {
  node.setAttribute(
    "aria-expanded",
    "false"
  );

  node.addEventListener(
    "pointerdown",
    (event) => {
      startDrag(event, node);
    }
  );

  node.addEventListener(
    "pointermove",
    moveDrag
  );

  node.addEventListener(
    "pointerup",
    endDrag
  );

  node.addEventListener(
    "pointercancel",
    endDrag
  );

  node.addEventListener("click", () => {
    if (
      node.dataset.justDragged === "true"
    ) {
      return;
    }

    openPanel(
      node.dataset.panel,
      node
    );
  });
});

closeButtons.forEach((button) => {
  button.addEventListener(
    "click",
    closePanels
  );
});

if (resetButton) {
  resetButton.addEventListener(
    "click",
    () => {
      if (!desktopQuery.matches) {
        return;
      }

      resetBodies();
    }
  );
}

window.addEventListener(
  "resize",
  handleResize
);

desktopQuery.addEventListener(
  "change",
  handleResponsiveChange
);

window.addEventListener("load", () => {
  initializeBodies();

  previousFrameTime =
    performance.now();

  if (!animationFrameId) {
    animationFrameId =
      window.requestAnimationFrame(
        animate
      );
  }
});

window.requestAnimationFrame(() => {
  initializeBodies();

  if (!animationFrameId) {
    animationFrameId =
      window.requestAnimationFrame(
        animate
      );
  }
});