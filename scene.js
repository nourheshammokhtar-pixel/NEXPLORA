(() => {
  'use strict';

  const canvas = document.querySelector('#worldCanvas');
  const gl = canvas && (canvas.getContext('webgl', { antialias: true, alpha: false }) ||
    canvas.getContext('experimental-webgl'));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const camera = { yaw: 0.1, pitch: 0.64, distance: 9, eye: [0, 6, 9], target: [0, 1, 0] };
  let program;
  let meshes = {};
  let groundClick = () => {};
  let pointer = null;
  let pointerMoved = false;
  let placementMove = () => {};

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uViewProjection;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vPosition = world.xyz;
      vNormal = normalize(mat3(uModel) * aNormal);
      gl_Position = uViewProjection * world;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec4 uColor;
    uniform vec3 uLightDirection;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      float light = 0.42 + 0.58 * max(dot(normalize(vNormal), normalize(uLightDirection)), 0.0);
      float fog = smoothstep(18.0, 38.0, length(vPosition.xz));
      vec3 color = mix(uColor.rgb * light, vec3(0.20, 0.25, 0.39), fog * 0.4);
      gl_FragColor = vec4(color, uColor.a);
    }
  `;

  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(result) || 'The lunar scene shader could not compile.');
    }
    return result;
  }

  function createProgram() {
    const value = gl.createProgram();
    gl.attachShader(value, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(value, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(value);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(value) || 'The lunar scene could not start.');
    }
    return value;
  }

  function mesh(positions, normals) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    return { positionBuffer, normalBuffer, count: positions.length / 3 };
  }

  function makeSphere(latitude = 12, longitude = 16) {
    const positions = [], normals = [];
    for (let lat = 0; lat < latitude; lat++) {
      const a0 = Math.PI * lat / latitude, a1 = Math.PI * (lat + 1) / latitude;
      for (let lon = 0; lon < longitude; lon++) {
        const b0 = Math.PI * 2 * lon / longitude, b1 = Math.PI * 2 * (lon + 1) / longitude;
        const point = (a, b) => [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
        const p = [point(a0, b0), point(a1, b0), point(a1, b1), point(a0, b0), point(a1, b1), point(a0, b1)];
        p.forEach(v => { positions.push(...v); normals.push(...v); });
      }
    }
    return mesh(positions, normals);
  }

  function makeBox() {
    const faces = [
      [[0, 0, 1], [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]]],
      [[0, 0, -1], [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]]],
      [[1, 0, 0], [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,-0.5,0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]]],
      [[-1, 0, 0], [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]]],
      [[0, 1, 0], [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]]],
      [[0, -1, 0], [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]]]
    ];
    const positions = [], normals = [];
    faces.forEach(([normal, points]) => points.forEach(point => { positions.push(...point); normals.push(...normal); }));
    return mesh(positions, normals);
  }

  function makeCylinder(segments = 16) {
    const positions = [], normals = [];
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const p0 = [Math.cos(a), -0.5, Math.sin(a)], p1 = [Math.cos(b), -0.5, Math.sin(b)];
      const p2 = [Math.cos(b), 0.5, Math.sin(b)], p3 = [Math.cos(a), 0.5, Math.sin(a)];
      [p0,p1,p2,p0,p2,p3].forEach(p => {
        positions.push(...p);
        const length = Math.hypot(p[0], p[2]) || 1;
        normals.push(p[0] / length, 0, p[2] / length);
      });
      positions.push(0,-0.5,0,...p1,...p0,0,0,0);
      normals.push(0,-1,0,0,-1,0,0,-1,0);
      positions.push(0,0.5,0,...p3,...p2);
      normals.push(0,1,0,0,1,0,0,1,0);
    }
    return mesh(positions, normals);
  }

  function terrainHeight(x, z) {
    const craters = [[-7,-5,2.1], [6,-7,2.8], [8,6,2.2], [-9,7,1.7], [1,9,2.5]];
    let height = Math.sin(x * 0.34) * Math.cos(z * 0.29) * 0.18 + Math.sin((x + z) * 0.16) * 0.24;
    craters.forEach(([cx, cz, radius]) => {
      const d = Math.hypot(x - cx, z - cz);
      height -= Math.exp(-Math.pow((d - radius) / 0.48, 2)) * 0.55;
      height += Math.exp(-Math.pow(d / 1.15, 2)) * 0.09;
    });
    return height;
  }

  function makeTerrain() {
    const positions = [], normals = [], steps = 64, span = 30;
    const points = [];
    for (let z = 0; z <= steps; z++) {
      points[z] = [];
      for (let x = 0; x <= steps; x++) {
        const px = (x / steps - 0.5) * span, pz = (z / steps - 0.5) * span;
        points[z][x] = [px, terrainHeight(px, pz), pz];
      }
    }
    const addTriangle = (a, b, c) => {
      const ux = b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2];
      const vx = c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
      let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const length=Math.hypot(nx,ny,nz)||1; nx/=length; ny/=length; nz/=length;
      [a,b,c].forEach(p=>{positions.push(...p);normals.push(nx,ny,nz);});
    };
    for (let z=0;z<steps;z++) for (let x=0;x<steps;x++) {
      const a=points[z][x],b=points[z][x+1],c=points[z+1][x+1],d=points[z+1][x];
      addTriangle(a,d,b);addTriangle(b,d,c);
    }
    return mesh(positions,normals);
  }

  function identity() {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  }

  function multiply(a, b) {
    const out = new Array(16);
    for (let col=0;col<4;col++) for (let row=0;row<4;row++) {
      out[col*4+row]=a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];
    }
    return out;
  }

  function transform(x, y, z, sx=1, sy=1, sz=1, rotation=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation);
    return [c*sx,0,-s*sx,0, 0,sy,0,0, s*sz,0,c*sz,0, x,y,z,1];
  }

  function perspective(fov, aspect, near, far) {
    const f=1/Math.tan(fov/2),nf=1/(near-far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }

  function normalize(v) {
    const len=Math.hypot(v[0],v[1],v[2])||1;
    return [v[0]/len,v[1]/len,v[2]/len];
  }
  function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
  function subtract(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }

  function lookAt(eye, target, up) {
    const z=normalize(subtract(eye,target)),x=normalize(cross(up,z)),y=cross(z,x);
    return [
      x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],
      -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],
      -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2],1
    ];
  }

  function draw(name, x, y, z, sx, sy, sz, color, rotation=0, opacity=1) {
    const shape=meshes[name];
    if (!shape) return;
    gl.bindBuffer(gl.ARRAY_BUFFER,shape.positionBuffer);
    gl.vertexAttribPointer(program.position,3,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(program.position);
    gl.bindBuffer(gl.ARRAY_BUFFER,shape.normalBuffer);
    gl.vertexAttribPointer(program.normal,3,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(program.normal);
    gl.uniformMatrix4fv(program.model,false,new Float32Array(transform(x,y,z,sx,sy,sz,rotation)));
    gl.uniform4f(program.color,color[0],color[1],color[2],opacity);
    gl.drawArrays(gl.TRIANGLES,0,shape.count);
  }

  function drawAstronaut(state, time) {
    const p=state.player,ground=terrainHeight(p.x,p.z),walk=state.moving ? Math.sin(time*12)*0.07 : 0;
    const rotation=p.rotation||0;
    draw('sphere',p.x,ground+0.9+walk,p.z,0.52,0.65,0.38,[0.25,0.76,0.83],rotation);
    draw('sphere',p.x,ground+1.63+walk,p.z,0.42,0.42,0.42,[0.95,0.92,0.86],rotation);
    draw('sphere',p.x,ground+1.66+walk,p.z+0.22,0.23,0.22,0.1,[0.29,0.57,0.76],rotation);
    draw('box',p.x-0.18,ground+0.4+walk,p.z,0.16,0.62,0.17,[0.96,0.71,0.66],rotation);
    draw('box',p.x+0.18,ground+0.4-walk,p.z,0.16,0.62,0.17,[0.96,0.71,0.66],rotation);
  }

  function drawLander() {
    const x=-4.5,z=-3.6,y=terrainHeight(x,z);
    draw('cylinder',x,y+1.5,z,1.6,1.8,1.6,[0.83,0.87,0.94]);
    draw('cylinder',x,y+2.42,z,1.85,0.13,1.85,[0.99,0.79,0.4]);
    draw('box',x,y+0.5,z,2.7,0.16,2.7,[0.79,0.83,0.88]);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dz])=>draw('box',x+dx*0.9,y+0.2,z+dz*0.9,0.12,0.7,0.12,[0.87,0.88,0.9]));
  }

  function drawBuilding(building) {
    const y=terrainHeight(building.x,building.z), color=building.color||[0.7,0.8,0.92];
    if (building.type==='habitat') {
      draw('cylinder',building.x,y+0.8,building.z,2.7,1.5,2.2,[0.74,0.82,0.95]);
      draw('sphere',building.x,y+1.55,building.z,1.15,0.8,0.96,[0.35,0.79,0.85]);
    } else if (building.type==='solar') {
      draw('box',building.x-0.8,y+0.55,building.z,1.5,0.08,1.8,[0.2,0.42,0.72],-0.2);
      draw('box',building.x+0.8,y+0.55,building.z,1.5,0.08,1.8,[0.2,0.42,0.72],0.2);
      draw('cylinder',building.x,y+0.3,building.z,0.14,0.6,0.14,[0.84,0.84,0.87]);
    } else if (building.type==='life') {
      draw('cylinder',building.x,y+0.65,building.z,1.5,1.25,1.35,[0.43,0.78,0.7]);
      draw('cylinder',building.x,y+1.38,building.z,0.85,0.25,0.85,[0.89,0.94,0.95]);
    } else if (building.type==='shelter') {
      draw('box',building.x,y+0.68,building.z,2.2,1.25,2,[0.66,0.64,0.8]);
      draw('sphere',building.x,y+1.18,building.z,1.2,0.55,1.08,[0.42,0.67,0.86]);
    } else if (building.type==='lab') {
      draw('box',building.x,y+0.65,building.z,2.2,1.2,1.9,[0.89,0.83,0.87]);
      draw('sphere',building.x,y+1.36,building.z,0.75,0.52,0.75,[0.55,0.82,0.77]);
    } else {
      draw('box',building.x,y+0.65,building.z,2.1,1.2,1.9,color);
      if (building.type==='rover') draw('box',building.x,y+1.4,building.z,1.2,0.45,0.9,[0.93,0.71,0.37]);
      if (building.type==='storage') draw('box',building.x,y+1.38,building.z,1.3,0.35,1.3,[0.88,0.72,0.5]);
    }
  }

  function resize() {
    if (!gl) return;
    const ratio=Math.min(window.devicePixelRatio||1,1.75);
    const width=Math.max(1,Math.floor(canvas.clientWidth*ratio));
    const height=Math.max(1,Math.floor(canvas.clientHeight*ratio));
    if (canvas.width!==width||canvas.height!==height) {
      canvas.width=width;canvas.height=height;
    }
  }

  function render(state, time) {
    if (!gl || !state || !canvas.clientWidth || !canvas.clientHeight) return;
    resize();
    const width=canvas.clientWidth,height=canvas.clientHeight;
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.055,0.08,0.16,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    const p=state.player, ground=terrainHeight(p.x,p.z);
    const target=[p.x,ground+0.65,p.z];
    const horizontal=camera.distance*Math.cos(camera.pitch);
    const eye=[p.x+Math.sin(camera.yaw)*horizontal, target[1]+camera.distance*Math.sin(camera.pitch),p.z+Math.cos(camera.yaw)*horizontal];
    camera.eye=eye;camera.target=target;
    const viewProjection=multiply(perspective(Math.PI/3,width/height,0.1,100),lookAt(eye,target,[0,1,0]));
    gl.uniformMatrix4fv(program.viewProjection,false,new Float32Array(viewProjection));
    gl.uniform3f(program.lightDirection,-0.5,0.9,0.35);

    draw('terrain',0,0,0,1,1,1,[0.64,0.67,0.72]);
    draw('sphere',-16,14,-20,2.2,2.2,2.2,[0.21,0.58,0.88]);
    for (let i=0;i<38;i++) {
      const x=((i*37)%57)-28,z=((i*71)%57)-28,y=12+(i%6)*1.6;
      draw('sphere',x,y,z,0.035,0.035,0.035,[0.9,0.94,1]);
    }
    drawLander();
    draw('cylinder',state.basePosition?.x||0,terrainHeight(state.basePosition?.x||0,state.basePosition?.z||0)+0.04,state.basePosition?.z||0,4.4,0.05,4.4,[0.36,0.84,0.79],0,0.22);
    (state.entities||[]).filter(item=>!item.collected).forEach(item=>{
      const y=terrainHeight(item.x,item.z), bob=Math.sin(time*3+item.x)*0.1;
      const color=item.kind==='sample'?[0.77,0.65,0.94]:item.kind==='materials'?[0.91,0.71,0.43]:
        item.kind==='energy'?[0.98,0.81,0.35]:item.kind==='water'?[0.34,0.77,0.91]:item.kind==='food'?[0.52,0.85,0.57]:[0.66,0.88,0.94];
      draw('sphere',item.x,y+0.5+bob,item.z,0.35,0.42,0.35,color);
      draw('sphere',item.x,y+0.91+bob,item.z,0.16,0.16,0.16,[0.99,0.95,0.81]);
    });
    (state.buildings||[]).forEach(drawBuilding);
    if (state.roverOnTrip) {
      const rx=p.x+Math.sin(time*0.35)*5,rz=p.z+Math.cos(time*0.35)*5,y=terrainHeight(rx,rz);
      draw('box',rx,y+0.5,rz,1.1,0.42,0.82,[0.95,0.74,0.34]);
      draw('cylinder',rx-0.38,y+0.25,rz,0.25,0.22,0.25,[0.13,0.18,0.25]);
      draw('cylinder',rx+0.38,y+0.25,rz,0.25,0.22,0.25,[0.13,0.18,0.25]);
    } else {
      const roverBuilding=(state.buildings||[]).find(b=>b.type==='rover');
      if(roverBuilding) {
        const rx=roverBuilding.x+2.2,rz=roverBuilding.z,y=terrainHeight(rx,rz);
        draw('box',rx,y+0.4,rz,0.92,0.38,0.72,[0.95,0.74,0.34]);
        draw('cylinder',rx-0.34,y+0.2,rz,0.23,0.18,0.23,[0.13,0.18,0.25]);
        draw('cylinder',rx+0.34,y+0.2,rz,0.23,0.18,0.23,[0.13,0.18,0.25]);
      }
    }
    if (state.placement) {
      const {x,z,valid}=state.placement;
      draw('cylinder',x,terrainHeight(x,z)+0.06,z,3.8,0.08,3.8,valid?[0.29,0.92,0.65]:[0.95,0.34,0.4],0,0.5);
      drawBuilding({...state.placement, type:state.placement.type, x, z, color:[0.5,0.8,0.7]});
    }
    drawAstronaut(state,time);
  }

  function groundPoint(clientX, clientY) {
    const rect=canvas.getBoundingClientRect(),nx=((clientX-rect.left)/rect.width)*2-1,ny=1-((clientY-rect.top)/rect.height)*2;
    const forward=normalize(subtract(camera.target,camera.eye)),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
    const scale=Math.tan(Math.PI/6),aspect=rect.width/rect.height;
    const direction=normalize([
      forward[0]+right[0]*nx*scale*aspect+up[0]*ny*scale,
      forward[1]+right[1]*nx*scale*aspect+up[1]*ny*scale,
      forward[2]+right[2]*nx*scale*aspect+up[2]*ny*scale
    ]);
    if(direction[1]>=-0.01)return null;
    const distance=-camera.eye[1]/direction[1];
    const x=camera.eye[0]+direction[0]*distance,z=camera.eye[2]+direction[2]*distance;
    if(!Number.isFinite(x)||!Number.isFinite(z))return null;
    return {x:clamp(x,-14,14),z:clamp(z,-14,14)};
  }

  if (!gl) {
    window.NexWorldError='This browser could not start WebGL. Try a current browser with graphics acceleration enabled.';
    window.dispatchEvent(new CustomEvent('nex-world-error',{detail:window.NexWorldError}));
    return;
  }
  try {
    program=createProgram();
    program.position=gl.getAttribLocation(program,'aPosition');
    program.normal=gl.getAttribLocation(program,'aNormal');
    program.viewProjection=gl.getUniformLocation(program,'uViewProjection');
    program.model=gl.getUniformLocation(program,'uModel');
    program.color=gl.getUniformLocation(program,'uColor');
    program.lightDirection=gl.getUniformLocation(program,'uLightDirection');
    meshes={sphere:makeSphere(),box:makeBox(),cylinder:makeCylinder(),terrain:makeTerrain()};
  } catch (error) {
    window.NexWorldError=error.message;
    window.dispatchEvent(new CustomEvent('nex-world-error',{detail:window.NexWorldError}));
    return;
  }

  canvas.addEventListener('pointerdown',event=>{
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};
    pointerMoved=false;canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    const point=groundPoint(event.clientX,event.clientY);
    if(point)placementMove(point);
    if(!pointer||pointer.id!==event.pointerId)return;
    const dx=event.clientX-pointer.lastX,dy=event.clientY-pointer.lastY;
    if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>4)pointerMoved=true;
    if(pointerMoved){
      camera.yaw-=dx*0.008;
      camera.pitch=clamp(camera.pitch+dy*0.006,0.22,1.15);
    }
    pointer.lastX=event.clientX;pointer.lastY=event.clientY;
  });
  canvas.addEventListener('pointerup',event=>{
    if(pointer&&pointer.id===event.pointerId&&!pointerMoved){
      const point=groundPoint(event.clientX,event.clientY);
      if(point)groundClick(point);
    }
    pointer=null;
  });
  canvas.addEventListener('pointercancel',()=>{pointer=null;});
  canvas.addEventListener('wheel',event=>{
    event.preventDefault();
    camera.distance=clamp(camera.distance+Math.sign(event.deltaY)*0.9,5,16);
  },{passive:false});
  window.addEventListener('resize',resize);

  window.NexWorld={
    render,
    getViewState(){return {yaw:camera.yaw,pitch:camera.pitch,distance:camera.distance};},
    setGroundClickHandler(handler){groundClick=handler;},
    setPlacementMoveHandler(handler){placementMove=handler;},
    terrainHeight,
    isReady:true
  };
})();
