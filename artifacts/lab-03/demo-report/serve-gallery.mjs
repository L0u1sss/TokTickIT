import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const types={html:'text/html; charset=utf-8',png:'image/png',md:'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  try {
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
    if(!/^(index\.html|README\.md|[0-9]{2}-[a-z0-9-]+\.png)$/.test(name)){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(new URL(name,root));
    res.writeHead(200,{'Content-Type':types[name.split('.').pop()],'Cache-Control':'no-cache'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(5180,'127.0.0.1',()=>console.log('Gallery: http://127.0.0.1:5180'));
