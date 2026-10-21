"""Local-only latency evidence; never loads dotenv files or invokes cloud OCR."""
import os,sys,time,json,socket,ipaddress
from pathlib import Path
from pydantic_settings import BaseSettings
root=Path(__file__).resolve().parents[1]
os.environ['GEMINI_API_KEY']='';os.environ['DATABASE_URL']='sqlite+aiosqlite:///:memory:'
os.environ['JWT_SECRET']='isolated-benchmark-secret-not-for-deployment'
original=BaseSettings.__init__
def isolated(self,*a,**kw):
 if self.__class__.__module__=='app.config':kw['_env_file']=None
 original(self,*a,**kw)
BaseSettings.__init__=isolated
original_connect=socket.socket.connect
def local_connect(sock,address):
 if isinstance(address,tuple):
  try: permitted=ipaddress.ip_address(address[0]).is_loopback
  except ValueError: permitted=address[0]=='localhost'
  if not permitted:raise OSError('External network disabled during local OCR benchmark')
 return original_connect(sock,address)
socket.socket.connect=local_connect
sys.path.insert(0,str(root/'apps/api'))
from app.services.ocr_service import _read_local_lines
from app.services.local_rx_parser import _parse_rx_lines_to_medicines
from PIL import Image,ImageDraw,ImageFont
import io
image=Image.new('RGB',(1100,700),'white');draw=ImageDraw.Draw(image);font=ImageFont.truetype('arial.ttf',30)
for i,line in enumerate(['Patient Name: Demo','Panadol 500mg Tablet','Augmentin 625mg Tablet','xyzmed 50mg Tablet']):draw.text((60,60+i*100),line,font=font,fill='black')
buffer=io.BytesIO();image.save(buffer,format='PNG')
report=[]
samples=[('printed_synthetic',buffer.getvalue())]
if (root/'prescription1.jpeg').exists():samples.append(('prescription1',(root/'prescription1.jpeg').read_bytes()))
if '--pipeline-only' in sys.argv:
 import asyncio
 from app.services import ocr_service as service
 async def pipeline_report():
  results=[]
  for label,data in samples:
   mime='image/png' if label=='printed_synthetic' else 'image/jpeg'
   started=time.perf_counter();result=await service.extract_from_image(data,mime)
   results.append({'image':label,'request_seconds':round(time.perf_counter()-started,3),'engine':result['engine'],'candidates':len(result['candidates']),'cloud_calls':result['provider_attempts']})
   if service._LOCAL_JOB:await asyncio.wrap_future(service._LOCAL_JOB[1])
   started=time.perf_counter();again=await service.extract_from_image(data,mime)
   results[-1]['retry_seconds']=round(time.perf_counter()-started,3)
   results[-1]['retry_engine']=again['engine'];results[-1]['retry_candidates']=len(again['candidates'])
  print(json.dumps(results,indent=2))
 asyncio.run(pipeline_report())
 raise SystemExit(0)
for label,data in samples:
 timings=[];counts=[]
 for run in range(3):
  started=time.perf_counter();result=_read_local_lines(data,'image/png' if label=='printed_synthetic' else 'image/jpeg');candidates=_parse_rx_lines_to_medicines(result['lines']);timings.append(round(time.perf_counter()-started,3));counts.append(len(candidates))
 report.append({'image':label,'seconds_cold_then_warm':timings,'candidate_counts':counts})
print(json.dumps(report,indent=2))
(root/'scratch').mkdir(exist_ok=True)
(root/'scratch/rapidocr-benchmark.json').write_text(json.dumps(report,indent=2))
