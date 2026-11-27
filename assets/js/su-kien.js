"use strict";
let eventYear = 'all', eventListOpen = false, selectedEvent = null;
const eventDetails = e => e.details || {};
const eventAdmin = () => state.user?.role === 'admin';
const evNode = (tag, text = '', cls = '') => textElement(tag, cls, text);
function evButton(label, action) { const b = evNode('button', label); b.type = 'button'; b.onclick = action; return b; }
function evTime(value) {
  if (!value) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + '+09:00');
}
function evDate(value) { const t = evTime(value); return Number.isFinite(t) ? new Intl.DateTimeFormat('vi-VN', {timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short'}).format(t) : 'Đang cập nhật'; }
function evLocal(value) { const t=evTime(value); if(!Number.isFinite(t)) return ''; return new Date(t+9*3600000).toISOString().slice(0,16); }
function evYear(e) {return String(eventDetails(e).year || evLocal(e.event_date).slice(0,4));}
function evStatus(e) {
 const d=eventDetails(e); if(d.status==='cancelled') return 'Đã hủy'; if(d.status==='postponed') return 'Hoãn'; if(d.unknown_date) return 'Dự kiến';
 const now=Date.now(), start=evTime(e.event_date), end=d.end ? evTime(d.end) : evTime(evLocal(e.event_date).slice(0,10)+'T23:59');
 return now<start?'Sắp diễn ra':now<=end?'Đang diễn ra':'Đã diễn ra';
}
function evLink(label,url) { if(!url || !/^https:\/\//i.test(url)) return null; const a=evNode('a',label,'ev-link'); a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a; }
function renderEvents() {
 $('#add-event').hidden=!eventAdmin(); const root=$('#events-list');root.replaceChildren();
 if(selectedEvent) {const e=state.events.find(e=>String(e.id)===String(selectedEvent));if(e){renderEventDetail(e,root);return;} selectedEvent=null;}
 const all=state.events.filter(e=>eventDetails(e).visibility!=='trash');
 {const upcoming=all.filter(e=>['Sắp diễn ra','Đang diễn ra','Dự kiến'].includes(evStatus(e)) && (eventDetails(e).visibility||'published')==='published').sort((a,b)=>evTime(a.event_date)-evTime(b.event_date));
 const box=evNode('section','','ev-section');box.append(evNode('h2','SẮP DIỄN RA'));if(!upcoming.length)box.append(evNode('p','Chưa có sự kiện sắp diễn ra.'));upcoming.forEach(e=>box.append(eventCard(e)));root.append(box);}
 const archive=evNode('section','','ev-archive ev-accordion');root.append(archive);
 const toggle=evButton('',()=>{eventListOpen=!eventListOpen;renderEvents();});toggle.className='ev-accordion-toggle';
 toggle.append(evNode('span','DANH SÁCH SỰ KIỆN'),evNode('span',eventListOpen?'⌃':'⌄','ev-chevron'));
 toggle.setAttribute('aria-expanded',String(eventListOpen));toggle.setAttribute('aria-controls','event-archive-body');archive.append(toggle);
 const body=evNode('div','','ev-accordion-body');body.id='event-archive-body';body.hidden=!eventListOpen;archive.append(body);
 const toolbar=evNode('div','','ev-actions');
 const years=[...new Set(all.map(evYear))].sort().reverse();if(eventYear!=='all'&&!years.includes(eventYear))eventYear='all';
 const label=evNode('label','Lọc theo năm ');const select=evNode('select');select.setAttribute('aria-label','Lọc sự kiện theo năm');
 for(const y of ['all',...years]){const o=evNode('option',y==='all'?'Tất cả':y);o.value=y;select.append(o);}
 select.value=eventYear;select.onchange=()=>{eventYear=select.value;renderEvents();};label.append(select);toolbar.append(label);archive.insertBefore(toolbar,body);
 if(!eventListOpen)return;
 const rows=all.filter(e=>eventYear==='all'||evYear(e)===eventYear).sort((a,b)=>evTime(b.event_date)-evTime(a.event_date));if(!rows.length)body.append(evNode('p','Chưa có sự kiện.'));rows.forEach(e=>body.append(eventCard(e)));
}
function eventCard(e){
 const card=evNode('article','','ev-card ev-click-card');const info=evNode('div');
 const open=()=>{selectedEvent=e.id;renderEvents();$('#page-su-kien').scrollIntoView();};
 const heading=evNode('h3');const title=evButton(e.title,open);title.className='ev-card-title';title.setAttribute('aria-label','Xem sự kiện '+e.title);heading.append(title);
 info.append(heading,evNode('p',(eventDetails(e).unknown_date?'Chưa chốt ngày':evDate(e.event_date))+' · '+(e.location||'Địa điểm đang cập nhật')),evNode('p',e.description||''));card.append(info);
 card.onclick=ev=>{if(!ev.target.closest('button,a,input,select,textarea'))open();};
 if(eventAdmin()){const actions=evNode('div','','ev-actions');addEventActions(e,actions);card.append(actions);}return card;
}

function evIcon(label, path, action){
 const button=evButton('',action);button.title=label;button.setAttribute('aria-label',label);button.className='ev-icon';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',path);svg.append(line);button.append(svg);return button;
}
function addEventActions(e,box){const v=eventDetails(e).visibility||'published';
 box.append(evIcon('Sửa sự kiện','M16 3l5 5-12 12H4v-5L16 3z M14 5l5 5',()=>openEvent(e)),
 evIcon(v==='published'?'Ẩn sự kiện':'Hiện sự kiện','M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0'+(v==='published'?' M3 3l18 18':''),()=>changeEvent(e,v==='published'?'hidden':'published')),
 evIcon('Xóa sự kiện','M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',()=>deleteEvent(e)));}
function renderEventDetail(e,root){root.append(evButton('← Danh sách sự kiện',()=>{selectedEvent=null;renderEvents();}));root.append(evNode('h2',e.title.toUpperCase(),'ev-heading'));
 const d=eventDetails(e);
 const section=(title,text)=>{const box=evNode('section','','ev-section');box.append(evNode('h3',title));if(text)box.append(evNode('p',text,'ev-text'));root.append(box);return box;};
 section('THÔNG TIN CHƯƠNG TRÌNH',`${d.unknown_date?'Chưa chốt ngày':evDate(e.event_date)}${d.end?' — '+evDate(d.end):''}\n${e.location||'Địa điểm đang cập nhật'}\n\n${e.description||''}\n\n${d.content||''}`);
 if(d.schedule)section('LỊCH TRÌNH',d.schedule);
 for(const block of eventBlocks(d)){
   if(block.internal&&!eventAdmin())continue;
   const box=section(block.title.toUpperCase(),block.notes||'');box.classList.add('ev-category');
   const files=evNode('div','','ev-attachments');
   (block.attachments||[]).filter(file=>!file.internal||eventAdmin()).forEach(file=>{const a=evLink(file.name,file.url);if(a)files.append(a);});
   if(files.children.length)box.append(files);
 }
 if(eventAdmin()){const b=evNode('div','','ev-actions');addEventActions(e,b);root.append(b);}}
function eventBlocks(d){
 if(Array.isArray(d.blocks))return d.blocks;
 return d.documents?.length?[{title:'Tài liệu',notes:'',internal:false,attachments:d.documents}]:[];
}
function evField(labelText,input){const label=evNode('label',labelText);label.append(input);return label;}
function attachmentRow(parent,file={}){
 const row=evNode('div','','ev-attachment-editor');
 const name=evNode('input');name.value=file.name||'';name.required=true;name.maxLength=120;name.className='ev-file-name';
 const url=evNode('input');url.type='url';url.value=file.url||'';url.required=true;url.placeholder='https://drive.google.com/...';url.className='ev-file-url';
 const internal=evNode('input');internal.type='checkbox';internal.checked=!!file.internal;internal.className='ev-file-internal';
 row.append(evField('Tên tệp',name),evField('Liên kết tệp',url),evField('Chỉ quản trị viên ',internal));
 const actions=evNode('div','','ev-actions');actions.append(evButton('↑',()=>{if(row.previousElementSibling)row.before(row.previousElementSibling);}),evButton('↓',()=>{if(row.nextElementSibling)row.after(row.nextElementSibling);}),evButton('Bỏ tệp',()=>row.remove()));row.append(actions);parent.append(row);
}
function blockRow(block={}){
 const root=$('#event-blocks');if(root.children.length>=30){notify('Tối đa 30 hạng mục.');return;}
 const row=evNode('section','','ev-block-editor');
 const title=evNode('input');title.value=block.title||'';title.required=true;title.maxLength=120;title.placeholder='Ví dụ: Ẩm thực';title.className='ev-block-title';
 const notes=evNode('textarea');notes.value=block.notes||'';notes.rows=3;notes.maxLength=10000;notes.className='ev-block-notes';
 const internal=evNode('input');internal.type='checkbox';internal.checked=!!block.internal;internal.className='ev-block-internal';
 const controls=evNode('div','','ev-actions');controls.append(evButton('↑',()=>{if(row.previousElementSibling)row.before(row.previousElementSibling);}),evButton('↓',()=>{if(row.nextElementSibling)row.after(row.nextElementSibling);}),evButton('Bỏ hạng mục',()=>{if(confirm('Bỏ hạng mục này khỏi biểu mẫu? Thay đổi có hiệu lực khi lưu.'))row.remove();}));
 row.append(controls,evField('Tên hạng mục',title),evField('Ghi chú',notes),evField('Hạng mục chỉ dành cho quản trị viên ',internal));
 const files=evNode('div','','ev-block-files');(block.attachments||[]).forEach(file=>attachmentRow(files,file));row.append(files,evButton('＋ Thêm tệp đính kèm',()=>{if(files.children.length>=50){notify('Tối đa 50 tệp mỗi hạng mục.');return;}attachmentRow(files);}));root.append(row);
}
function readEventBlocks(){return Array.from($('#event-blocks').children).map(row=>({
 title:row.querySelector('.ev-block-title').value.trim(),notes:row.querySelector('.ev-block-notes').value.trim(),internal:row.querySelector('.ev-block-internal').checked,
 attachments:Array.from(row.querySelector('.ev-block-files').children).map(file=>({name:file.querySelector('.ev-file-name').value.trim(),url:file.querySelector('.ev-file-url').value.trim(),internal:file.querySelector('.ev-file-internal').checked}))
}));}
function openEvent(e=null){$('#event-form').reset();$('#event-error').hidden=true;$('#event-title').textContent=e?'SỬA SỰ KIỆN':'THÊM SỰ KIỆN';$('#event-id').value=e?.id||'';const d=e?eventDetails(e):{};
 for(const [id,key] of [['name','title'],['location','location'],['description','description']])$('#event-'+id).value=e?.[key]||'';
 setEventDate('date',e?evLocal(e.event_date):'');setEventDate('end',d.end||'');$('#event-year').value=d.year||(e?evYear(e):new Date().getFullYear());$('#event-unknown').checked=!!d.unknown_date;
 for(const key of ['content','schedule'])$('#event-'+key).value=d[key]||'';
 $('#event-blocks').replaceChildren();eventBlocks(d).forEach(blockRow);$('#event-publish').textContent=e?'Lưu thay đổi':'Đăng sự kiện';toggleEventDate();$('#event-dialog').showModal();$('#event-dialog').scrollTop=0;}
function setEventDate(key,value){const local=value?evLocal(value):'';$('#event-'+key).value=local.slice(0,10);$('#event-'+key+'-hour').value=local.slice(11,13)||'13';$('#event-'+key+'-minute').value=local.slice(14,16)||'00';}
function getEventDate(key){const day=$('#event-'+key).value;return day?day+'T'+$('#event-'+key+'-hour').value+':'+$('#event-'+key+'-minute').value:'';}
function toggleEventDate(){const unknown=$('#event-unknown').checked;for(const k of ['date','end'])for(const suffix of ['', '-hour','-minute'])$('#event-'+k+suffix).disabled=unknown;$('#event-date').required=!unknown;}
async function changeEvent(e,visibility){try{await request('/api/events/'+e.id,'PUT',{...e,event_date:evLocal(e.event_date),details:{...eventDetails(e),visibility}});await refresh();notify('Đã cập nhật sự kiện.');}catch(err){notify(err.message);}}
async function deleteEvent(e){if(!confirm(`Xóa vĩnh viễn sự kiện “${e.title}”? Không thể khôi phục trên app. Tài liệu Drive vẫn được giữ.`))return;try{await request('/api/events/'+e.id,'DELETE',{});selectedEvent=null;await refresh();notify('Đã xóa sự kiện.');}catch(err){notify(err.message);}}
$('#add-event').onclick=()=>openEvent();$('#event-add-block').onclick=()=>blockRow();$('#event-unknown').onchange=toggleEventDate;
$('#event-form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget;const id=$('#event-id').value;const previous=state.events.find(e=>String(e.id)===id);const details={...eventDetails(previous||{}),visibility:eventDetails(previous||{}).visibility==='hidden'?'hidden':'published',deadline:'',year:Number($('#event-year').value),unknown_date:$('#event-unknown').checked,status:'auto',end:getEventDate('end')};
 for(const key of ['content','schedule'])details[key]=$('#event-'+key).value.trim();
 details.blocks=readEventBlocks();details.documents=[];
 const body={title:$('#event-name').value.trim(),event_date:getEventDate('date'),location:$('#event-location').value.trim(),description:$('#event-description').value.trim(),details};
 const buttons=form.querySelectorAll('button');buttons.forEach(b=>{if(!b.hasAttribute('data-close-dialog'))b.disabled=true;});try{await request(id?'/api/events/'+id:'/api/events',id?'PUT':'POST',body);$('#event-dialog').close();await refresh();notify('Đã lưu sự kiện.');}catch(err){$('#event-error').textContent=err.message;$('#event-error').hidden=false;}finally{buttons.forEach(b=>b.disabled=false);}};

for(const key of ['date','end'])for(const [part,total] of [['hour',24],['minute',60]]){const select=$('#event-'+key+'-'+part);for(let n=0;n<total;n++){const value=String(n).padStart(2,'0');const option=evNode('option',value);option.value=value;select.append(option);}}
