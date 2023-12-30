import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/**the following import is used to call the Threejs module at runtime. Threejs CDN */
//import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.module.js";

const MAX_ANCHORED_OBJECTS = 20;
async function ActivateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl2", { xrCompatible: true });

  //Scene Creation
  const scene = new THREE.Scene();

  //ThreeJS webGL Renderer
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
  //document.body.appendChild(renderer.domElement);

  //checking for WebGL2 support
  //console.log(renderer.capabilities.isWebGL2);

  //CSS2DRenderer Setup
  const labelRenderer = new CSS2DRenderer({
    element: document.querySelector("#css2dRenderer"),
  });
  //labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0px";

  //Camera Creation
  const camera = new THREE.PerspectiveCamera();
  //const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.matrixAutoUpdate = false;

  //WebXR session creation
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "anchors", "dom-overlay"],
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

  //Drawing Line between marked points and displaying the distance between them
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xdd4444, linewidth: 8 });
  const points = [];
  let pointIndexCounter = 0;
  let reticleHitTestResult;

  //Creating Anchors
  let anchoredPoints = [];
  function AddAnchoredObjectsToScene(anchor) {
    let indicatorMarker = indicator.clone();
    scene.add(indicatorMarker);

    anchoredPoints.push({
      anchoredPoint: indicatorMarker,
      anchor: anchor,
    });

    if (anchoredPoints.length > MAX_ANCHORED_OBJECTS) {
      let pointToRemove = anchoredPoints.shift();
      scene.remove(pointToRemove.anchoredPoint);
      pointToRemove.anchor.delete();
    }
  }

  document.querySelector("#markPoint").addEventListener("click", () => {
    //obtain the anchor from the hit test results and creat the anchor point
    reticleHitTestResult.createAnchor().then(
      (anchor) => {
        AddAnchoredObjectsToScene(anchor);
      },
      (error) => {
        console.error("Could not create anchor: " + error);
      }
    );

    //CSS2DObject for Static length display
    let staticLength = document.createElement("div");
    staticLength.className = "label";
    staticLength.style.backgroundColor = "transparent";

    const staticLengthLabel = new CSS2DObject(staticLength);
    staticLengthLabel.center.set(0.2, 1);

    //saving marked points in an array
    points.push(new THREE.Vector3(reticle.position.x, reticle.position.y, reticle.position.z));

    if (points.length > 1 && points.length % 2 == 0) {
      let line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[pointIndexCounter], points[pointIndexCounter + 1]]), lineMaterial);
      scene.add(line);

      staticLengthLabel.element.textContent = `${DistanceCalc(points[pointIndexCounter], points[pointIndexCounter + 1])} m`;
      //staticLengthLabel.position.set(points[pointIndexCounter + 1].x * 0.01, 0, points[pointIndexCounter + 1].z * 0.01);
      anchoredPoints[anchoredPoints.length - 1].anchoredPoint.add(staticLengthLabel);

      pointIndexCounter += 2;
    }
  });

  //CSS2DObject for Dynamic length display
  let dynamicLength = document.createElement("div");
  dynamicLength.className = "label";
  dynamicLength.textContent = "0.0 m";
  dynamicLength.style.backgroundColor = "transparent";

  const dynamicLengthLabel = new CSS2DObject(dynamicLength);
  dynamicLengthLabel.center.set(-0.2, 1.1);
  reticle.add(dynamicLengthLabel);

  //CSS2DObject for Dynamic angle display
  //  let dynamicAngle = document.createElement("div");
  //  dynamicAngle.className = "label";
  //  dynamicAngle.textContent = "0.0 deg";
  //  dynamicAngle.style.backgroundColor = "transparent";

  //  const dynamicAngleLabel = new CSS2DObject(dynamicAngle);
  //  dynamicAngleLabel.center.set(-0.15, 0);
  //  reticle.add(dynamicAngleLabel);

  //Realtime line
  let dynamicLine;
  const onXRFrame = (time, frame) => {
    session.requestAnimationFrame(onXRFrame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);

    if (pose) {
      const view = pose.views[0];
      const viewport = session.renderState.baseLayer.getViewport(view);

      //WebGL renderer size
      renderer.setSize(viewport.width, viewport.height);

      //CSS2DRenderer size
      labelRenderer.setSize(window.innerWidth, window.innerHeight);

      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      //Getting Hit Test Results from Source
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        //Hide the message when tracking is stable and hit test is working.
        document.getElementById("initial-text").style.display = "none";

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        //reticle.matrix.fromArray(hitPose.transform.matrix);
        reticle.updateMatrixWorld(true);

        //Passing Hit test results to create anchors.
        reticleHitTestResult = hitTestResults[0];

        document.getElementById("x-coordinate").innerHTML = `${hitPose.transform.position.x.toFixed(3)}`;
        document.getElementById("y-coordinate").innerHTML = `${hitPose.transform.position.y.toFixed(3)}`;
        document.getElementById("z-coordinate").innerHTML = `${hitPose.transform.position.z.toFixed(3)}`;

        if (points.length > 0) {
          if (points.length % 2 == 1) {
            scene.remove(dynamicLine);

            dynamicLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[points.length - 1], reticle.position]), lineMaterial);
            scene.add(dynamicLine);

            //Update length label
            dynamicLengthLabel.position.set(reticle.position.x * 0.01, 0, reticle.position.z * 0.01);
            dynamicLengthLabel.element.textContent = `${DistanceCalc(points[points.length - 1], reticle.position)} m`;

            //Update Angle label
            //dynamicAngleLabel.position.set(reticle.position.x * 0.01, 0, reticle.position.z * 0.01);
            //dynamicAngleLabel.element.textContent = `${AngleCalc(points[points.length - 1], reticle.position)} deg`;
          } else {
            dynamicLengthLabel.element.textContent = "0.0 m";
            //dynamicAngleLabel.element.textContent = "0.0 deg";
          }
        }

        for (let i = 1; i < anchoredPoints.length; i++) {
          if (frame.trackedAnchors.has(anchoredPoints[i].anchor)) {
            //Returns the 3D object Mesh
            //console.log(anchoredPoint);

            //Returns the XRPose of the anchor
            //console.log(anchorPose);

            const anchorPose = frame.getPose(anchoredPoints[i].anchor.anchorSpace, referenceSpace);
            let anchoredObject = anchoredPoints[i].anchoredPoint;

            //anchoredPoint.matrix = anchorPose.transform.matrix;
            anchoredObject.position.copy(anchorPose.transform.position);
            anchoredObject.updateMatrixWorld(true);
          } else {
            continue;
          }
        }
      } else {
        //show default message when tracking is lost/loading and hit test isn't working.
        document.getElementById("initial-text").style.display = "block";
      }

      //render the WebGL scene.
      renderer.render(scene, camera);
      //render the CSS2DRenderer scene.
      labelRenderer.render(scene, camera);
    } else {
      //show default message when tracking is lost/loading and hit test isn't working.
      document.getElementById("initial-text").style.display = "block";
    }
  };
  session.requestAnimationFrame(onXRFrame);
}

document.getElementById("startAR").addEventListener("click", ActivateAR);

function DistanceCalc(markedPoint1, markedPoint2) {
  let dx = markedPoint1.x - markedPoint2.x;
  let dz = markedPoint1.z - markedPoint2.z;

  let distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dz, 2));

  return distance.toFixed(3);
}

//function AngleCalc(markedPoint1, markedPoint2) {
//  let origin = new THREE.Vector2(0, 0);
//  let v_1 = new THREE.Vector2(markedPoint1.x, markedPoint1.z);
//  let v_2 = new THREE.Vector2(markedPoint2.x, markedPoint2.z);

//  //let distOriginV1 = origin.distanceTo(v_1);
//  let distOriginV2 = origin.distanceTo(v_2);
//  let distV1V2 = v_1.distanceTo(v_2);

//  let distFactor = distOriginV2 / distV1V2;
//  let angleV1V2 = v_1.angleTo(v_2);

//  let angleBig = Math.asin(distFactor * Math.sin(angleV1V2));
//  let angle = (angleBig + angleV1V2 - Math.PI / 2) / 2;

//  return (angle * (180 / Math.PI)).toFixed(1);
//}
