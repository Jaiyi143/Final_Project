const glyphs={
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  0:['01110','10011','10101','10101','10101','11001','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','01100','01100'],',':['00000','00000','00000','00000','01100','01100','01000'],':':['00000','01100','01100','00000','01100','01100','00000'],'!':['00100','00100','00100','00100','00100','00000','00100'],'?':['01110','10001','00001','00010','00100','00000','00100'],'-':['00000','00000','00000','11111','00000','00000','00000'],'_':['00000','00000','00000','00000','00000','00000','11111'],'/':['00001','00001','00010','00100','01000','10000','10000'],'+':['00000','00100','00100','11111','00100','00100','00000'],'=':['00000','00000','11111','00000','11111','00000','00000'],'#':['01010','01010','11111','01010','11111','01010','01010'],'%':['11001','11001','00010','00100','01000','10011','10011'],'(':['00010','00100','01000','01000','01000','00100','00010'],')':['01000','00100','00010','00010','00010','00100','01000'],'<':['00010','00100','01000','10000','01000','00100','00010'],'>':['01000','00100','00010','00001','00010','00100','01000']
};

const canvas=document.getElementById('lcd');
const serialButton=document.getElementById('serial-button');
const serialStatus=document.getElementById('serial-status');
const latestOutput=document.getElementById('latest-output');
const ledElements=[...document.querySelectorAll('[data-led]')];
const modeButtons={
  0:document.getElementById('mode-idle'),
  1:document.getElementById('mode-blink'),
  2:document.getElementById('mode-run'),
  3:document.getElementById('mode-alt'),
  4:document.getElementById('mode-all')
};
const modeNames={0:'Idle / Stop',1:'Blink',2:'Run',3:'ALT',4:'Run All'};
let port=null;
let reader=null;
let readTask=null;
let connected=false;
let switchMode=0;
let serialBuffer='';
let serialLines=['STATUS:','WAITING...'];

function setConnectionState(active,message){
  connected=active;
  if(!active)switchMode=0;
  serialStatus.textContent=message;
  serialButton.textContent=active?'Disconnect':'Connect ESP32';
  serialButton.disabled=false;
  Object.values(modeButtons).forEach(button=>{
    button.disabled=!active||switchMode!==0;
    if(!active)button.setAttribute('aria-pressed','false');
  });
  if(!active)ledElements.forEach(led=>led.classList.toggle('on',false));
  draw();
}

function handleSerialLine(line){
  if(/^(SWITCH|LOCKED):[0-3]$/.test(line)){
    switchMode=Number(line.at(-1));
    Object.values(modeButtons).forEach(button=>button.disabled=!connected||switchMode!==0);
    serialStatus.textContent=switchMode
      ?`Physical switches control ${modeNames[switchMode]}.`
      :'Connected — web controls available.';
    latestOutput.textContent=serialStatus.textContent;
    return;
  }
  if(/^LEDS:[01]{6}$/.test(line)){
    [...line.slice(5)].forEach((state,index)=>ledElements[index]?.classList.toggle('on',state==='1'));
    return;
  }
  if(line.startsWith('LCD:')){
    const divider=line.indexOf('|',4);
    if(divider!==-1){
      serialLines=[line.slice(4,divider).slice(0,16),line.slice(divider+1).slice(0,16)];
      draw();
    }
    return;
  }
  if(/^MODE:[0-4]$/.test(line)){
    const selected=Number(line[5]);
    Object.entries(modeButtons).forEach(([number,button])=>button.setAttribute('aria-pressed',String(Number(number)===selected)));
    serialStatus.textContent=switchMode
      ?`Physical switches control ${modeNames[switchMode]}.`
      :selected===0?'Connected — idle.':`Connected — ${modeNames[selected]} active.`;
    latestOutput.textContent=serialStatus.textContent;
    return;
  }
  if(/^STEP:[123]$/.test(line)){
    const step=Number(line[5]);
    serialStatus.textContent=`Connected — Run All: ${modeNames[step]}.`;
    latestOutput.textContent=serialStatus.textContent;
    return;
  }
  if(/^DONE:[1-4]$/.test(line)){
    const finished=Number(line[5]);
    Object.values(modeButtons).forEach(button=>button.setAttribute('aria-pressed','false'));
    serialStatus.textContent=`Connected — ${modeNames[finished]} complete.`;
    latestOutput.textContent=serialStatus.textContent;
    return;
  }
  if(line.trim())latestOutput.textContent=line.trim();
}

function receiveText(text){
  serialBuffer+=text;
  const parts=serialBuffer.split('\n');
  serialBuffer=parts.pop().slice(-1024);
  for(const part of parts){
    handleSerialLine(part.replace(/\r$/, ''));
  }
}

async function selectMode(number){
  if(!connected||switchMode!==0||!port?.writable)return;
  Object.values(modeButtons).forEach(button=>button.disabled=true);
  try{
    const writer=port.writable.getWriter();
    try{await writer.write(new TextEncoder().encode(`${number}\n`));}
    finally{writer.releaseLock();}
    serialStatus.textContent='Mode command sent — waiting for ESP32.';
  }catch(error){
    serialStatus.textContent=`Could not send mode: ${error.message}`;
  }finally{
    Object.values(modeButtons).forEach(button=>button.disabled=!connected||switchMode!==0);
  }
}

async function readSerial(){
  const decoder=new TextDecoder();
  let endMessage='Disconnected';
  try{
    while(port?.readable){
      reader=port.readable.getReader();
      try{
        while(true){
          const {value,done}=await reader.read();
          if(done)break;
          if(value)receiveText(decoder.decode(value,{stream:true}));
        }
      }finally{
        reader.releaseLock();
        reader=null;
      }
      break;
    }
  }catch(error){
    endMessage=`Serial read stopped: ${error.message}`;
  }finally{
    const closingPort=port;
    port=null;
    if(closingPort){try{await closingPort.close();}catch{}}
    serialBuffer='';
    setConnectionState(false,endMessage);
  }
}

async function connectSerial(){
  if(!('serial' in navigator)){
    serialStatus.textContent='Web Serial is unavailable. Use Chrome or Edge on localhost.';
    return;
  }
  serialButton.disabled=true;
  serialStatus.textContent='Choose your ESP32 serial port…';
  try{
    const selectedPort=await navigator.serial.requestPort();
    await selectedPort.open({baudRate:115200});
    port=selectedPort;
    serialBuffer='';
    serialLines=['STATUS:','WAITING...'];
    setConnectionState(true,'Connected — waiting for serial output.');
    readTask=readSerial();
  }catch(error){
    serialButton.disabled=false;
    serialStatus.textContent=error.name==='NotFoundError'
      ?'No port selected.'
      :`Could not connect: ${error.message}`;
  }
}

async function disconnectSerial(){
  serialButton.disabled=true;
  serialStatus.textContent='Disconnecting…';
  if(reader){try{await reader.cancel();}catch{}}
  if(readTask)await readTask;
}

function draw(){
  const ratio=window.devicePixelRatio||1;
  const width=Math.max(1,Math.round(canvas.clientWidth*ratio));
  const height=Math.max(1,Math.round(canvas.clientHeight*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,width,height);
  const pitchX=width/96;
  const pitchY=height/20;
  const dotW=pitchX*.76;
  const dotH=pitchY*.70;
  ctx.fillStyle='rgba(21,70,44,.13)';
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)for(let y=0;y<8;y++)for(let x=0;x<5;x++){
    ctx.fillRect((col*6+x)*pitchX,(row*10+y)*pitchY,dotW,dotH);
  }
  ctx.fillStyle='#193d2a';
  const lines=connected?serialLines:['STATUS:','DISCONNECTED'];
  lines.forEach((line,row)=>{
    const chars=line.slice(0,16);
    [...chars].forEach((char,col)=>{
      const bitmap=glyphs[char.toUpperCase()]||glyphs['?'];
      bitmap.forEach((bits,y)=>[...bits].forEach((bit,x)=>{
        if(bit==='1')ctx.fillRect((col*6+x)*pitchX,(row*10+y)*pitchY,dotW,dotH);
      }));
    });
  });
  canvas.setAttribute('aria-label',`LCD showing ${lines[0]||'blank'} on the first row and ${lines[1]||'blank'} on the second row`);
}

serialButton.addEventListener('click',()=>connected?disconnectSerial():connectSerial());
Object.entries(modeButtons).forEach(([number,button])=>button.addEventListener('click',()=>selectMode(Number(number))));
new ResizeObserver(draw).observe(canvas);
draw();
