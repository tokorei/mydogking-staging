const form = document.querySelector('form');
const button = form.querySelector('button');
const message = document.querySelector('#status');
async function prepare() {
  await navigator.serviceWorker.register('preview-worker.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {
    await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
  }
}
prepare().then(()=>{
  button.disabled=false;
}).catch(()=>{message.textContent='Open this preview in a browser that supports service workers and browser storage.';});
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(button.disabled)return;
  button.disabled=true;
  message.textContent='Opening preview…';
  const channel=new MessageChannel();
  channel.port1.onmessage=({data})=>{
    channel.port1.close();
    if(data==='ok'){location.reload();return;}
    button.disabled=false;
    message.textContent=data==='denied'?'Incorrect password. Try again.':'Preview unavailable. Refresh and try again.';
    form.elements.pw.select();
  };
  navigator.serviceWorker.controller.postMessage({password:form.elements.pw.value},[channel.port2]);
});
