import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Image as ImageIcon, Shield, ShieldOff, 
  Wand2, Plus, GripVertical, Trash2, Camera, Map, Printer, 
  Table, Clock, Sparkles, X, StickyNote, Utensils,
  LayoutDashboard, LogOut, Copy, PlaneTakeoff, Trash, AlertCircle, CheckCircle2, Upload, Edit3, Check, CalendarDays, ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';

// ==========================================
// --- 您的專屬設定 (Firebase & Gemini) ---
// ==========================================
const myFirebaseConfig = {
  apiKey: "AIzaSyBYSMSVqRLWI5eU_FMCw67Qhb-XI8eQTfc",
  authDomain: "travel-app-2625d.firebaseapp.com",
  projectId: "travel-app-2625d",
  storageBucket: "travel-app-2625d.firebasestorage.app",
  messagingSenderId: "208628280569",
  appId: "1:208628280569:web:6d51d429ebf3235480c628",
  measurementId: "G-FCT41DPRMQ"
};

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const firebaseConfig = (!isLocalhost && typeof __firebase_config !== 'undefined' && __firebase_config) 
  ? JSON.parse(__firebase_config) 
  : myFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 核心修復 (Rule 1): 防止路徑段數錯誤
const rawAppId = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'my-travel-workspace';
const appId = String(rawAppId).replace(/\//g, '_'); 

const API_KEY = (typeof __api_key !== 'undefined' && __api_key) ? __api_key : "AIzaSyALQDdxgNkwoV2Y-lVjZk-JF2yLokJ7cc0"; 

// --- 工具函數：圖片壓縮 ---
const compressImage = (file, maxWidth = 1600, quality = 0.8) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

// --- 工具函數：複製連結 ---
const copyToClipboard = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

// ==========================================
// 全域 UI 組件：自訂訊息框
// ==========================================
const CustomModal = ({ isOpen, type, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  let displayMessage = typeof message === 'string' ? message : String(message?.message || JSON.stringify(message) || '');

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full overflow-hidden transform animate-in zoom-in-95 duration-200 text-left border border-slate-100">
        <div className={`p-8 flex flex-col items-center text-center ${type === 'error' ? 'bg-red-50' : type === 'success' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
          {type === 'error' ? <AlertCircle className="w-16 h-16 text-red-500 mb-4" /> : 
           type === 'success' ? <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" /> : 
           <Sparkles className="w-16 h-16 text-blue-500 mb-4" />}
          <h3 className="text-2xl font-black text-slate-800">{title}</h3>
          <p className="mt-4 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{displayMessage}</p>
        </div>
        <div className="p-4 flex gap-3 bg-white">
          {onCancel && (
            <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition">取消</button>
          )}
          <button onClick={onConfirm} className={`flex-1 py-4 text-white font-bold rounded-2xl transition shadow-lg ${type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-900'}`}>確定</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 1. Dashboard Component
// ==========================================
function Dashboard({ user, onSelectProject, handleGoogleLogin, handleLogout, setModal }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const unsub = onSnapshot(projectsRef, (snapshot) => {
      const allProjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const myProjects = allProjects.filter(p => p.adminUid === user.uid);
      myProjects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProjects(myProjects);
      setLoading(false);
    }, (err) => {
      setLoading(false);
      if (err.code === 'permission-denied') {
        setModal({ isOpen: true, type: 'error', title: '權限不足', message: '資料庫存取被拒。請確認 Firebase Firestore Rules 已設為測試模式。', onConfirm: () => setModal({ isOpen: false }) });
      }
    });
    return () => unsub();
  }, [user, setModal]);

  const handleCreateProject = async () => {
    if (!user) return;
    const newId = 'trip_' + Date.now();
    const today = new Date().toISOString().split('T')[0];
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', newId), {
        title: '未命名的奇幻旅程', coverImage: '', adminUid: user.uid, isEditable: true, dates: [today], createdAt: Date.now()
      });
      onSelectProject(newId);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans text-left">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
          <div className="flex items-center space-x-3 text-left">
            <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg"><PlaneTakeoff className="w-8 h-8 text-white" /></div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Travel Workspace</h1>
              <p className="text-slate-500 font-medium text-sm">您的 AI 旅遊規劃控制中心</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.providerData?.some(p => p.providerId === 'google.com') ? (
              <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
                <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full" />
                <span className="text-sm font-bold text-slate-700">{user.displayName}</span>
                <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 ml-2"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-5 py-2 rounded-full shadow-sm text-sm font-bold flex items-center transition-all">
                <Sparkles className="w-4 h-4 mr-2" /> Google 登入同步
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20"><Sparkles className="w-12 h-12 text-emerald-500 animate-pulse" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div onClick={handleCreateProject} className="bg-white border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-[40px] h-64 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all group shadow-sm">
              <div className="bg-emerald-100 text-emerald-600 p-5 rounded-full group-hover:scale-110 transition-transform mb-4"><Plus className="w-10 h-10" /></div>
              <h3 className="text-lg font-bold text-emerald-700">展開新的旅程</h3>
            </div>
            {projects.map(proj => (
              <div key={proj.id} onClick={() => onSelectProject(proj.id)} className="group relative bg-white rounded-[40px] h-64 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all border border-slate-200">
                {proj.coverImage ? <img src={proj.coverImage} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="absolute inset-0 bg-slate-200 flex items-center justify-center text-slate-400 opacity-30"><ImageIcon className="w-12 h-12" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <h3 className="text-2xl font-black mb-1 line-clamp-1">{proj.title}</h3>
                  <div className="flex items-center text-slate-300 text-sm font-medium"><Clock className="w-4 h-4 mr-2" /> {proj.dates?.length || 1} 天行程</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setModal({ isOpen: true, type: 'error', title: '刪除專案？', message: `確定要永久刪除「${proj.title}」嗎？`, onConfirm: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', proj.id)); setModal({ isOpen: false }); }, onCancel: () => setModal({ isOpen: false }) }); }} className="absolute top-6 right-6 bg-white/20 hover:bg-red-500 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"><Trash className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. Trip Editor Component
// ==========================================
function TripEditor({ projectId, user, goBack, handleGoogleLogin, handleLogout, setModal }) {
  const [tripConfig, setTripConfig] = useState({ title: '載入中...', coverImage: '', adminUid: null, isEditable: true, dates: [] });
  const [itinerary, setItinerary] = useState([]);
  const [selectedDate, setSelectedDate] = useState('SUMMARY');
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [newItemTime, setNewItemTime] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [editingLocId, setEditingLocId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user || !projectId) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTripConfig(data);
      } else { goBack(); }
    });
    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`);
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setItinerary(items);
    });
    return () => { unsubConfig(); unsubItems(); };
  }, [user, projectId, goBack]);

  const isAdmin = user?.uid === tripConfig?.adminUid;
  const canEdit = isAdmin || tripConfig?.isEditable;

  // AI 智慧備援
  const callGemini = async (prompt, isJson = false) => {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];
    for (const model of models) {
      try {
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        if (isJson && model !== 'gemini-pro') payload.generationConfig = { responseMimeType: "application/json" };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          return text.replace(/```json/gi, "").replace(/```/g, "").trim();
        }
      } catch (e) { }
    }
    throw new Error("AI 暫時無法連線。");
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingAI(true); setLoadingMsg('正在處理並適配背景地圖...');
    try {
      const compressedUrl = await compressImage(file);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { coverImage: compressedUrl });
      setModal({ isOpen: true, type: 'success', title: '上傳成功', message: '地圖背景已完整適配顯示比例！', onConfirm: () => setModal({ isOpen: false }) });
    } catch (err) { console.error(err); }
    finally { setLoadingAI(false); }
  };

  // --- 核心優化：AI 生成邏輯 (移除廢話、確保真實) ---
  const generateAllForDate = async (type) => {
    const targets = itinerary.filter(i => i.date === selectedDate && (type === 'desc' ? !i.description : !i.foodRecs));
    if (targets.length === 0) {
      setModal({ isOpen: true, type: 'info', title: '皆已完成', message: '這天的行程都已經有 AI 內容囉！', onConfirm: () => setModal({ isOpen: false }) });
      return;
    }
    setLoadingAI(true);
    for (let item of targets) {
      setLoadingMsg(`AI 導遊正在研究「${item.location}」的精確資料...`);
      try {
        const prompt = type === 'desc' 
          ? `你是一位專業資深的歷史導遊。請為景點「${item.location}」提供真實、準確的歷史故事與冷知識。
            要求：
            1. 嚴禁編造事實，必須符合真實歷史。
            2. 直接進入主題，禁止任何自我介紹、廢話或幽默開場白。
            3. 繁體中文。
            4. 格式：
               【📜 歷史故事】
               （內容）
               【💡 冷知識】
               （內容）`
          : `你是一位資深美食家導遊。請推薦景點「${item.location}」周邊 3 間名店。
            要求：
            1. 禁止廢話。
            2. 直接列出店名、推薦原因（如：名人推薦、米其林入選、在地老店等）、必點菜色。
            3. 每間店必須附上 Google Maps 搜尋連結（Markdown 格式：[開啟地圖導航](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('店名 ' + item.location)})）。
            4. 繁體中文。`;
        const res = await callGemini(prompt);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { [type === 'desc' ? 'description' : 'foodRecs']: res });
      } catch (e) { console.error(e); }
    }
    setLoadingAI(false);
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    if (!canEdit || !draggedItem || draggedItem.id === targetItem.id) return;
    const dateItems = itinerary.filter(i => i.date === selectedDate).sort((a,b) => (a.order || 0) - (b.order || 0));
    const newItems = [...dateItems];
    const draggedIdx = newItems.findIndex(i => i.id === draggedItem.id);
    newItems.splice(draggedIdx, 1);
    const targetIdx = newItems.findIndex(i => i.id === targetItem.id);
    newItems.splice(targetIdx, 0, draggedItem);

    const batch = writeBatch(db);
    newItems.forEach((item, index) => {
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { order: index });
    });
    await batch.commit();
    setDraggedItem(null);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedDate || selectedDate === 'SUMMARY') return;
    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`);
    await addDoc(itemsRef, {
      date: selectedDate, time: newItemTime, location: newItemText, notes: '', description: '', foodRecs: '', photos: [], order: Date.now()
    });
    setNewItemText(''); setNewItemTime('');
  };

  const renderSummaryTable = () => {
    const dates = tripConfig.dates || [];
    if (dates.length === 0) return <div className="py-20 text-center text-slate-400">目前沒有任何行程日期。</div>;
    const allTimes = [...new Set(itinerary.map(i => i.time || '全天'))].sort();

    return (
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 border-r border-slate-200 w-24 font-black text-slate-500 text-xs uppercase tracking-widest text-center">時間</th>
              {dates.map(date => (
                <th key={date} className="p-4 min-w-[200px] border-r border-slate-200 font-black text-slate-800 text-center">
                  <div className="text-xs text-blue-500 mb-1">Day {dates.indexOf(date) + 1}</div>
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTimes.map(time => (
              <tr key={time} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 border-r border-slate-200 bg-slate-50/30 text-center">
                  <span className="inline-block px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-600 shadow-sm">{time}</span>
                </td>
                {dates.map(date => {
                  const items = itinerary.filter(i => i.date === date && (i.time || '全天') === time);
                  return (
                    <td key={`${date}-${time}`} className="p-3 border-r border-slate-200 align-top">
                      {items.map(item => (
                        <a 
                          key={item.id}
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
                          target="_blank" rel="noreferrer"
                          className="block p-3 mb-2 bg-blue-50/50 hover:bg-blue-100 border border-blue-100 rounded-2xl transition group relative shadow-sm"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-sm font-black text-slate-800 leading-tight">{item.location}</span>
                            <MapPin className="w-3.5 h-3.5 text-blue-400 group-hover:scale-125 transition" />
                          </div>
                        </a>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const parts = text.split(/(\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a 
            key={i} 
            href={match[2]} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-flex items-center px-3 py-1 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition my-1 shadow-sm"
          >
            <ExternalLink className="w-3 h-3 mr-1" /> {match[1]}
          </a>
        );
      }
      return <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
    });
  };

  const currentItems = itinerary.filter(i => i.date === selectedDate).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-left">
      <div className="no-print bg-slate-900 text-white p-3 flex flex-wrap justify-between items-center shadow-lg gap-2 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="bg-slate-700 hover:bg-slate-600 px-4 py-1.5 rounded-xl transition text-sm font-bold shadow-sm flex items-center"><LayoutDashboard className="w-4 h-4 mr-2" /> 首頁</button>
          {isAdmin && (
            <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { isEditable: !tripConfig.isEditable })} className={`flex items-center text-xs px-3 py-1.5 rounded-xl font-bold transition ${tripConfig.isEditable ? 'bg-indigo-600' : 'bg-red-600'}`}>
              {tripConfig.isEditable ? <><Shield className="w-4 h-4 mr-1"/> 開放編輯</> : <><ShieldOff className="w-4 h-4 mr-1"/> 鎖定編輯</>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { copyToClipboard(window.location.href); setModal({ isOpen: true, type: 'success', title: '連結已複製', message: '分享給旅伴即可共享編輯！', onConfirm: () => setModal({ isOpen: false }) }); }} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-bold flex items-center"><Copy className="w-4 h-4 mr-1" /> 複製連結</button>
          <button onClick={() => setShowImportModal(true)} className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl font-bold flex items-center"><Table className="w-4 h-4 mr-1" /> 匯入 Excel</button>
          <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition text-slate-200"><Printer className="w-4 h-4" /></button>
          {user.photoURL && <img src={user.photoURL} alt="u" className="w-7 h-7 rounded-full border border-white/20 ml-2" />}
        </div>
      </div>

      <div className="relative min-h-[400px] md:min-h-[550px] w-full bg-slate-950 flex items-center justify-center group overflow-hidden">
        {tripConfig.coverImage ? (
          <img src={tripConfig.coverImage} className="max-h-full max-w-full object-contain transition-all duration-700" alt="Cover" />
        ) : (
          <div className="flex flex-col items-center text-slate-700 opacity-40"><ImageIcon className="w-20 h-20 mb-2" /><p className="font-bold">請上傳旅程背景地圖</p></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute bottom-10 left-0 right-0 z-10 w-full max-w-4xl mx-auto p-6 text-center">
          <input type="text" value={tripConfig.title} disabled={!canEdit} onChange={(e) => setTripConfig({...tripConfig, title: e.target.value})} onBlur={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { title: tripConfig.title })} className="text-4xl md:text-6xl font-black text-white bg-transparent text-center w-full focus:outline-none border-b-4 border-transparent hover:border-white/20 transition-all drop-shadow-xl" />
          {canEdit && (
            <div className="mt-8 flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleCoverUpload} />
              <button onClick={() => fileInputRef.current.click()} className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-6 py-2.5 rounded-full border border-white/30 hover:bg-white/40 flex items-center transition shadow-2xl active:scale-95"><Upload className="w-4 h-4 mr-2" /> 上傳/更換背景地圖</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 mt-8">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8 border-b border-slate-200 pb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar flex-1 items-center">
            <button 
              onClick={() => setSelectedDate('SUMMARY')}
              className={`px-6 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm shrink-0 flex items-center gap-2 ${selectedDate === 'SUMMARY' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
            >
              <CalendarDays className="w-4 h-4" /> 行程全程總覽
            </button>
            <div className="w-px h-8 bg-slate-200 mx-1 shrink-0"></div>
            {tripConfig.dates?.map(date => (
              <div key={date} className="relative group/date shrink-0">
                <button onClick={() => setSelectedDate(date)} className={`px-6 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm ${selectedDate === date ? 'bg-slate-800 text-white scale-105 shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>{date}</button>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); if(confirm("確定要刪除這天行程嗎？")) { const d = tripConfig.dates.filter(x => x !== date); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: d }); } }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/date:opacity-100 transition-opacity shadow-md"><X className="w-3 h-3" /></button>
                )}
              </div>
            ))}
            {canEdit && <button onClick={() => { const d = prompt("輸入新日期 (YYYY-MM-DD)"); if(d) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: [...(tripConfig.dates || []), d].sort() }); }} className="p-3 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-slate-600 shrink-0"><Plus className="w-5 h-5" /></button>}
          </div>
          
          {canEdit && selectedDate !== 'SUMMARY' && currentItems.length > 0 && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => generateAllForDate('desc')} className="text-xs font-black bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center shadow-md transition active:scale-95"><Sparkles className="w-3.5 h-3.5 mr-1.5" /> 一鍵生成導覽</button>
              <button onClick={() => generateAllForDate('food')} className="text-xs font-black bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl flex items-center shadow-md transition active:scale-95"><Utensils className="w-3.5 h-3.5 mr-1.5" /> 一鍵搜尋美食</button>
            </div>
          )}
        </div>

        {selectedDate === 'SUMMARY' ? (
          renderSummaryTable()
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            {currentItems.length === 0 ? (
              <div className="py-24 text-center text-slate-400 border-4 border-dashed border-slate-200 rounded-[50px] bg-white/50"><MapPin className="w-16 h-16 mx-auto mb-4 opacity-10" /><p className="text-xl font-black">這天還沒有行程，快來手動新增或是從 Excel 匯入吧！</p></div>
            ) : currentItems.map((item) => (
              <div 
                key={item.id} 
                draggable={canEdit}
                onDragStart={(e) => { setDraggedItem(item); e.currentTarget.style.opacity = '0.4'; }}
                onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; setDraggedItem(null); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, item)}
                className={`bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col gap-4 text-left group/item transition-all hover:shadow-md ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <div className="flex gap-6">
                  <div className="w-16 flex flex-col items-center shrink-0">
                    <div className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{item.time || '--:--'}</div>
                    <GripVertical className="mt-4 text-slate-300 group-hover/item:text-slate-500 transition-colors w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        {canEdit ? (
                          <div className="flex items-center gap-2 group/edit relative">
                            {editingLocId === item.id ? (
                              <div className="flex items-center gap-2 w-full">
                                <input 
                                  autoFocus
                                  defaultValue={item.location} 
                                  onBlur={(e) => { 
                                    if(e.target.value !== item.location) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { location: e.target.value });
                                    setEditingLocId(null);
                                  }}
                                  onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }}
                                  className="text-2xl font-black text-slate-800 w-full bg-slate-50 border-b-2 border-blue-500 focus:outline-none p-1 rounded"
                                />
                                <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                              </div>
                            ) : (
                              <div onClick={() => setEditingLocId(item.id)} className="cursor-text flex items-center gap-2">
                                <h3 className="text-2xl font-black text-slate-800">{item.location}</h3>
                                <Edit3 className="w-4 h-4 text-slate-300 opacity-0 group-hover/edit:opacity-100" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <h3 className="text-2xl font-black text-slate-800">{item.location}</h3>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:scale-125 transition shrink-0 p-1"><MapPin className="w-5 h-5" /></a>
                        {canEdit && <button onClick={async () => { if(confirm("確定刪除此行程項目？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id)); }} className="text-slate-200 hover:text-red-500 transition p-1 opacity-0 group-hover/item:opacity-100"><Trash2 className="w-5 h-5" /></button>}
                      </div>
                    </div>
                    
                    <textarea 
                      disabled={!canEdit}
                      defaultValue={item.notes || ''}
                      onBlur={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { notes: e.target.value })}
                      placeholder="新增備註 (點擊即可編輯)..."
                      className="w-full mt-3 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none font-medium text-slate-600"
                    />
                    
                    {/* 核心優化：固定高度可滾動區塊 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col overflow-hidden">
                        <div className="p-4 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
                          <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest flex items-center"><Sparkles className="w-3 h-3 mr-1" /> 專業歷史導覽與冷知識</h4>
                          {canEdit && (
                            <button onClick={async () => {
                              setLoadingAI(true); setLoadingMsg(`正在調閱 ${item.location} 的歷史文獻...`);
                              try {
                                const prompt = `你是一位專業資深的歷史導遊。請為景點「${item.location}」提供真實、準確的歷史故事與冷知識。
                                要求：嚴禁編造事實。直接進入主題，禁止自我介紹與廢話。繁體中文。格式：【📜 歷史故事】與【💡 冷知識】。`;
                                const res = await callGemini(prompt);
                                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { description: res });
                              } finally { setLoadingAI(false); }
                            }} className="p-1 text-indigo-400 hover:text-indigo-600 transition"><Wand2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        <div className="p-5 h-60 overflow-y-auto custom-scrollbar text-sm text-slate-700 leading-relaxed italic">
                          {item.description ? renderMarkdown(item.description) : '點擊按鈕，查看真實歷史故事...'}
                        </div>
                      </div>

                      <div className="bg-orange-50/50 rounded-2xl border border-orange-100 flex flex-col overflow-hidden">
                        <div className="p-4 bg-orange-100/50 border-b border-orange-100 flex justify-between items-center">
                          <h4 className="text-xs font-black text-orange-500 uppercase tracking-widest flex items-center"><Utensils className="w-3 h-3 mr-1" /> 精選老饕美食推薦</h4>
                          {canEdit && (
                            <button onClick={async () => {
                              setLoadingAI(true); setLoadingMsg(`正在搜尋 ${item.location} 的美食名店...`);
                              try {
                                const prompt = `你是一位資深美食家。請推薦景點「${item.location}」周邊 3 間名店。直接列出店名、推薦原因（如米其林、名人推薦）、必點菜色。附上 Google Maps 搜尋連結（Markdown：[開啟地圖導航](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('美食 ' + item.location)})）。不要廢話。繁體中文。`;
                                const res = await callGemini(prompt);
                                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { foodRecs: res });
                              } finally { setLoadingAI(false); }
                            }} className="p-1 text-orange-400 hover:text-orange-600 transition"><Wand2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        <div className="p-5 h-60 overflow-y-auto custom-scrollbar text-sm text-slate-700 leading-relaxed italic">
                          {item.foodRecs ? renderMarkdown(item.foodRecs) : '點擊按鈕，由老饕為您推薦美食...'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {canEdit && selectedDate && selectedDate !== 'SUMMARY' && (
              <form onSubmit={handleAddItem} className="bg-white p-5 rounded-[32px] border-2 border-emerald-100 shadow-sm flex flex-wrap gap-3 items-center focus-within:ring-4 focus-within:ring-emerald-50 transition-all">
                <input type="time" value={newItemTime} onChange={(e) => setNewItemTime(e.target.value)} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-sm outline-none w-36 font-bold" />
                <input type="text" placeholder="輸入景點名稱 (按 Enter 新增)..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} className="flex-1 min-w-[250px] bg-slate-50 border border-slate-100 p-3 rounded-2xl text-sm outline-none font-bold" />
                <button type="submit" disabled={!newItemText.trim()} className="bg-slate-800 text-white p-3.5 rounded-2xl hover:bg-slate-900 transition shadow-lg active:scale-95"><Plus className="w-6 h-6" /></button>
              </form>
            )}
          </div>
        )}
      </div>

      {loadingAI && <div className="fixed inset-0 z-[1000] bg-slate-900/70 backdrop-blur-lg flex items-center justify-center p-8"><div className="bg-white p-12 rounded-[50px] shadow-2xl flex flex-col items-center max-w-sm text-center transform animate-in zoom-in-95"><div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 animate-bounce"><Sparkles className="w-12 h-12 text-emerald-600" /></div><h3 className="text-3xl font-black text-slate-800 mb-3">AI 魔法施展中</h3><p className="text-slate-500 font-bold leading-relaxed">{loadingMsg}</p></div></div>}

      {showImportModal && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 text-left">
          <div className="bg-white rounded-[50px] w-full max-w-xl p-10 shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center mb-6"><h3 className="text-3xl font-black flex items-center gap-3 text-emerald-600"><Table className="w-8 h-8" /> 匯入 Excel 行程</h3><button onClick={() => setShowImportModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition text-slate-400"><X className="w-6 h-6" /></button></div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="直接貼上 Excel 內容（包含日期、時間、景點名稱）..." className="w-full h-64 bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-sm outline-none focus:ring-4 focus:ring-emerald-100 transition resize-none mb-6 font-mono font-bold" />
            <div className="flex gap-4"><button onClick={() => setShowImportModal(false)} className="flex-1 py-5 bg-slate-100 text-slate-600 font-black rounded-[24px] hover:bg-slate-200 transition text-center">取消</button><button onClick={async () => { 
              if(!importText.trim()) return; 
              setLoadingAI(true); setLoadingMsg('AI 正在同步雲端標籤與內容...'); 
              try { 
                const prompt = `我有一份行程資料：\n"""\n${importText}\n"""\n要求回傳純 JSON 陣列，格式：[{"date": "2026-04-15", "time": "10:30", "location": "地點名稱", "notes": "備註"}]`; 
                const json = await callGemini(prompt, true); 
                const data = JSON.parse(json); 
                const newDatesFound = [...new Set(data.map(item => item.date))].filter(Boolean);
                const mergedDates = [...new Set([...(tripConfig.dates || []), ...newDatesFound])].sort();
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: mergedDates });
                const batch = writeBatch(db); 
                data.forEach((item, idx) => { 
                  const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`)); 
                  batch.set(ref, { date: item.date || selectedDate, time: item.time || '', location: item.location || '未知景點', notes: item.notes || '', description: '', foodRecs: '', photos: [], order: Date.now() + idx }); 
                }); 
                await batch.commit(); 
                setShowImportModal(false); setModal({ isOpen: true, type: 'success', title: '匯入成功！', message: `已同步行程資料。`, onConfirm: () => setModal({ isOpen: false }) }); 
              } catch(e) { setModal({ isOpen: true, type: 'error', title: '解析失敗', message: String(e.message), onConfirm: () => setModal({ isOpen: false }) }); } 
              finally { setLoadingAI(false); } 
            }} className="flex-1 py-5 bg-emerald-600 text-white font-black rounded-[24px] shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition active:scale-95 text-lg">開始 AI 解析</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. Main Application Entry
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: () => {}, onCancel: null });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try { await signInWithCustomToken(auth, __initial_auth_token); } 
          catch (e) { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('p');
    if (p) setCurrentProjectId(p);
  }, []);

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400">
      <Sparkles className="w-16 h-16 text-emerald-500 animate-pulse mb-6" />
      <p className="font-black text-2xl animate-pulse text-slate-800 tracking-tighter text-center">正在與雲端旅遊數據同步...</p>
    </div>
  );

  const syncUrl = (id) => {
    const url = new URL(window.location);
    if (id) url.searchParams.set('p', id);
    else url.searchParams.delete('p');
    window.history.pushState({}, '', url);
  };

  return (
    <>
      {currentProjectId ? (
        <TripEditor projectId={currentProjectId} user={user} goBack={() => { setCurrentProjectId(null); syncUrl(null); }} handleGoogleLogin={async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error(e); } }} handleLogout={async () => { await signOut(auth); await signInAnonymously(auth); }} setModal={setModal} />
      ) : (
        <Dashboard user={user} onSelectProject={(id) => { setCurrentProjectId(id); syncUrl(id); }} handleGoogleLogin={async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error(e); } }} handleLogout={async () => { await signOut(auth); await signInAnonymously(auth); }} setModal={setModal} />
      )}
      <CustomModal {...modal} />
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        @media print { .no-print { display: none !important; } body { background: white; } }
      `}} />
    </>
  );
}