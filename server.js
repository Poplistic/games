<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Capitol Dome Control</title>
<style>
body { margin:0; overflow:hidden; background:black; }
#ui {
  position:absolute;
  top:10px;
  left:10px;
  background:#111;
  color:white;
  padding:10px;
  z-index:10;
}
input,button {
  width:200px;
  margin-top:5px;
}
</style>
</head>
<body>

<div id="ui">
  <input id="asset" placeholder="Roblox Image ID">
  <button onclick="addImage()">Add Image</button>
</div>

<script src="https://cdn.jsdelivr.net/npm/three@0.160/build/three.min.js"></script>
<script>
const API = "/"; // same origin

/* ================= THREE ================= */

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 1, 1000);
camera.position.set(0,80,220);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff));

/* ================= DOME ================= */

const RADIUS = 120;
for(let i=0;i<24;i++){
  const g = new THREE.BoxGeometry(30,60,2);
  const m = new THREE.MeshBasicMaterial({ color:0x222222 });
  const p = new THREE.Mesh(g,m);
  const a = i/24*Math.PI*2;
  p.position.set(Math.cos(a)*RADIUS,0,Math.sin(a)*RADIUS);
  p.rotation.y = -a;
  scene.add(p);
}

/* ================= IMAGES ================= */

let active = null;

function addImage(){
  const geo = new THREE.PlaneGeometry(40,20);
  const mat = new THREE.MeshBasicMaterial({
    color:0xffffff,
    side:THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo,mat);
  mesh.position.set(0,0,RADIUS);
  scene.add(mesh);

  mesh.userData = {
    id: crypto.randomUUID(),
    assetId: document.getElementById("asset").value,
    angle: 0,
    scale: 1
  };

  active = mesh;
  sync(mesh);
}

/* ================= CONTROLS ================= */

window.addEventListener("mousemove", e=>{
  if(!active) return;
  active.rotation.y += e.movementX * 0.005;
  active.userData.angle = active.rotation.y;
  sync(active);
});

window.addEventListener("wheel", e=>{
  if(!active) return;
  active.scale.multiplyScalar(e.deltaY > 0 ? 0.95 : 1.05);
  active.userData.scale = active.scale.x;
  sync(active);
});

/* ================= SYNC ================= */

function sync(mesh){
  fetch("/image",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify(mesh.userData)
  });
}

/* ================= LOOP ================= */

function animate(){
  requestAnimationFrame(animate);
  renderer.render(scene,camera);
}
animate();

window.onresize = ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
};
</script>

</body>
</html>
