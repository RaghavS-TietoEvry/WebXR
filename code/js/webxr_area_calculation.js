//import * as THREE from "three";
//import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.module.js";

async function ActivateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  //Scene Creation
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
    antialias: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = true;
  //renderer.setPixelRatio(window.devicePixelRatio);
  renderer.xr.enabled = true;

  //Camera Creation
  const camera = new THREE.PerspectiveCamera();
  //const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.matrixAutoUpdate = false;

  //WebXR session creation
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    domOverlay: { root: document.body },
  });

  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  //Creating viewer space and initializing the hit test source to extract results from.
  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({
    space: viewerSpace,
  });

  //Creating the reticle to indicate the hit point.
  const geometry = new THREE.RingGeometry(0.013, 0.035, 32);
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(0.25, 0.25, 0.25);

  const material = new THREE.MeshBasicMaterial({ color: 0xcc4444 });

  let reticle = new THREE.Mesh(geometry, material);
  //reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  //Marked Hit-point indicators
  const indicatorGeometery = new THREE.RingGeometry(0, 0.015, 32);
  indicatorGeometery.rotateX(-Math.PI / 2);
  indicatorGeometery.scale(0.2, 0.2, 0.2);

  const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0x118811 });

  const indicator = new THREE.Mesh(indicatorGeometery, indicatorMaterial);

  //Drawing Line
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xdd4444, linewidth: 8 });
  const points = [];

  document.querySelector("#markPoint").addEventListener("click", () => {
    let indicatorMarker = indicator.clone();
    indicatorMarker.position.copy(reticle.position);
    scene.add(indicatorMarker);

    points.push(new THREE.Vector3(reticle.position.x, reticle.position.y, reticle.position.z));

    let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    scene.add(line);
  });

  document.querySelector("#area").addEventListener("click", () => {
    AreaCalc(points);
  });

  let drawCount = 0;
  let dynamicLine;

  const onXRFrame = (time, frame) => {
    session.requestAnimationFrame(onXRFrame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);

    if (pose) {
      const view = pose.views[0];
      const viewport = session.renderState.baseLayer.getViewport(view);

      renderer.setSize(viewport.width, viewport.height);

      console.log("Viewport width: "+viewport.width);
      console.log("Device Window Width: "+window.innerWidth);
      
      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      //Getting Hit Test Results from Source
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        document.getElementById("initial-text").style.display = "none"; //Hide the message when tracking is stable and hit test is working.

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        // reticle.matrix.fromArray(hitPose.transform.matrix);
        reticle.updateMatrixWorld(true);

        document.getElementById("x-coordinate").innerHTML = `${hitPose.transform.position.x.toFixed(3)}`;
        document.getElementById("y-coordinate").innerHTML = `${hitPose.transform.position.y.toFixed(3)}`;
        document.getElementById("z-coordinate").innerHTML = `${hitPose.transform.position.z.toFixed(3)}`;

        if (points.length > 0) {
          if (drawCount != 0) {
            scene.remove(dynamicLine);

            dynamicLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[points.length - 1], reticle.position]), lineMaterial);
            scene.add(dynamicLine);
          } else {
            dynamicLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[points.length - 1], reticle.position]), lineMaterial);
            scene.add(dynamicLine);

            drawCount++;
          }
        }
      } else {
        document.getElementById("initial-text").style.display = "block"; //show default message when tracking is lost/loading and hit test isn't working.
        //console.log("no hit results generated");
      }

      renderer.render(scene, camera);
    } else {
      document.getElementById("initial-text").style.display = "block"; //show default message when tracking is lost/loading and hit test isn't working.
      //console.log("No Pose Dectected");
    }
  };
  session.requestAnimationFrame(onXRFrame);
}

document.getElementById("startAR").addEventListener("click", ActivateAR);

function AreaCalc(points) {
  if (points.length > 2) {
    if (points.length == 3) {
      let dxA = points[0].x - points[1].x;
      let dzA = points[0].z - points[1].z;

      let dxB = points[1].x - points[2].x;
      let dzB = points[1].z - points[2].z;

      let dxC = points[0].x - points[2].x;
      let dzC = points[0].z - points[2].z;

      let sideA = Math.sqrt(Math.pow(dxA, 2) + Math.pow(dzA, 2));
      let sideB = Math.sqrt(Math.pow(dxB, 2) + Math.pow(dzB, 2));
      let sideC = Math.sqrt(Math.pow(dxC, 2) + Math.pow(dzC, 2));

      let semiperimeter = (sideA + sideB + sideC) / 2;

      let area = Math.sqrt(semiperimeter * (semiperimeter - sideA) * (semiperimeter - sideB) * (semiperimeter - sideC)) * 10000;

      document.querySelector("#area-value").innerHTML = area.toFixed(3) + "cm^2";
    } else if (points.length == 4) {
      let dxLength = points[0].x - points[1].x;
      let dzLength = points[0].z - points[1].z;

      let dxWidth = points[1].x - points[2].x;
      let dzWidth = points[1].z - points[2].z;

      let quadLength = Math.sqrt(Math.pow(dxLength, 2) + Math.pow(dzLength, 2));
      let quadWidth = Math.sqrt(Math.pow(dxWidth, 2) + Math.pow(dzWidth, 2));

      let area = quadLength * quadWidth * 10000;

      document.querySelector("#area-value").innerHTML = area.toFixed(3) + "cm^2";
    }
  }
}
