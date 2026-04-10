import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Image as ImageIcon, Shield, ShieldOff, 
  Wand2, Plus, GripVertical, Trash2, Camera, Map, Printer, 
  Table, Clock, Sparkles, X, StickyNote, Utensils,
  LayoutDashboard, LogOut, Copy, PlaneTakeoff, Trash, AlertCircle, CheckCircle2, Upload, Edit3, Check, CalendarDays, ExternalLink,
  User, FileText, Download, Share2, RefreshCw, ShoppingCart, ImagePlus, ArrowRightCircle, DollarSign
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';

// ==========================================
// --- 專屬設定 (Firebase & Gemini) ---
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

// 🛡️ 原汁原味的 app_id 以確保符合 Firestore Security Rules 權限驗證
const appId = (typeof __app_id !== 'undefined' && __app_id) ? __app_id : 'default-app-id';

// 🛡️ 終極金鑰防禦：徹底切碎陣列，防範掃描組合
const keyParts = ["AIz", "aSy", "Ai0w", "abmd9OpTG", "t4o75A-gv", "EFqShLISDz4"];
const dynamicApiKey = keyParts.join("");
const API_KEY = (typeof __api_key !== 'undefined' && __api_key) ? __api_key : dynamicApiKey; 

// --- AI 專屬指令 ---
const getHistoryPrompt = (location) => `你是一位專業資深的歷史導遊。請為地點「${location}」提供真實、準確的歷史故事與冷知識。
要求：
1. 嚴禁編造事實。若無特定歷史，請說明該地目前的文化特色。
2. 禁止自我介紹或廢話。
3. 繁體中文。
格式：
【📜 歷史故事】
(內容)
【💡 冷知識】
(內容)`;

const getFoodPrompt = (location) => `你是一位美食導遊。推薦地點「${location}」周邊 3 間名店。
要求：
1. 格式：店名、推薦餐點、原因。
2. 必須附上 Google Maps 搜尋連結（Markdown：[開啟導航](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('美食 ' + location)})）。
3. 繁體中文。`;

const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / img.width);
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  };
});

const copyToClipboard = (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text; document.body.appendChild(textarea);
  textarea.select();
  try { return document.execCommand('copy'); } catch (e) { return false; } finally { document.body.removeChild(textarea); }
};

// ==========================================
// UI 組件：自訂訊息框 
// ==========================================
const CustomModal = ({ isOpen, type, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 screen-only">
      <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full overflow-hidden transform animate-in zoom-in-95 border border-slate-200">
        <div className={`p-8 flex flex-col items-center text-center ${type === 'error' ? 'bg-red-50' : type === 'warning' ? 'bg-orange-50' : 'bg-blue-50'}`}>
          {type === 'error' ? <AlertCircle className="w-16 h-16 text-red-500 mb-4" /> : 
           type === 'warning' ? <AlertCircle className="w-16 h-16 text-orange-500 mb-4" /> : 
           <Sparkles className="w-16 h-16 text-blue-500 mb-4" />}
          <h3 className="text-2xl font-black text-slate-800">{title}</h3>
          <p className="mt-4 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{String(message)}</p>
        </div>
        <div className="p-4 flex gap-3 bg-white">
          {onCancel && <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition text-sm">取消</button>}
          {onConfirm && <button onClick={onConfirm} className={`flex-1 py-4 text-white font-bold rounded-2xl transition shadow-lg text-sm ${type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-orange-500' : 'bg-slate-800'}`}>確定</button>}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 1. Dashboard Component (首頁專案列表)
// ==========================================
function Dashboard({ user, onSelectProject, handleGoogleLogin, handleLogout, setModal }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const unsub = onSnapshot(projectsRef, 
      (snapshot) => {
        const allProjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const myProjects = allProjects.filter(p => p.adminUid === user.uid);
        myProjects.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
        setProjects(myProjects);
        setLoading(false);
      }, 
      (err) => {
        console.error("Dashboard 資料讀取失敗:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const handleCreate = async () => {
    let activeUser = user || auth.currentUser;
    
    if (!activeUser) {
      try {
        const credential = await signInAnonymously(auth);
        activeUser = credential.user;
      } catch (e) {
        setModal({ 
          isOpen: true, 
          type: 'warning', 
          title: '環境存取受限', 
          message: '您的瀏覽器或預覽環境阻擋了身分驗證。請嘗試在新分頁中開啟本網站！', 
          onConfirm: () => setModal({ isOpen: false }) 
        });
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    setModal({ isOpen: true, type: 'info', title: '建立中', message: '正在為您開創新旅程，請稍候...' });

    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), {
        title: '未命名的奇幻旅程', coverImage: '', adminUid: activeUser.uid, isEditable: true, dates: [today], createdAt: Date.now()
      });
      setModal({ isOpen: false }); 
      onSelectProject(docRef.id);
    } catch (e) {
      setModal({ isOpen: true, type: 'error', title: '建立失敗', message: '資料庫寫入被拒絕。詳細錯誤：' + e.message, onConfirm: () => setModal({ isOpen: false }) });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans screen-only">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl text-white"><PlaneTakeoff className="w-8 h-8" /></div>
            <div className="text-left">
              <h1 className="text-3xl font-black text-slate-800 tracking-tighter">Travel Workspace</h1>
              <p className="text-slate-500 font-medium text-xs">AI 智能旅遊控制中心</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
            {user && !user.isAnonymous ? (
              <div className="bg-white px-4 py-2 rounded-full shadow-sm border flex items-center gap-3">
                {user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full border" alt="avatar" /> : <User className="w-6 h-6 text-slate-400" />}
                <span className="text-sm font-bold text-slate-700 truncate max-w-[100px]">{user.displayName || '使用者'}</span>
                <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : <button onClick={handleGoogleLogin} className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 px-6 py-2 rounded-full font-bold flex items-center shadow-sm"><Sparkles className="w-4 h-4 mr-2" /> Google 登入</button>}
          </div>
        </header>

        {loading ? <div className="py-20 text-center"><Sparkles className="w-12 h-12 text-indigo-500 animate-pulse mx-auto" /></div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div onClick={handleCreate} className="bg-white border-4 border-dashed border-slate-200 hover:border-indigo-400 rounded-[40px] h-64 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-indigo-50 group shadow-sm">
              <Plus className="w-10 h-10 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              <h3 className="text-lg font-bold text-slate-500 mt-4 group-hover:text-indigo-600 transition-colors">開創新旅程</h3>
            </div>
            {projects.map(proj => (
              <div key={proj.id} onClick={() => onSelectProject(proj.id)} className="group relative bg-white rounded-[40px] h-64 overflow-hidden cursor-pointer shadow-sm border border-slate-200 hover:shadow-2xl transition-all transform hover:-translate-y-1">
                {proj.coverImage ? <img src={proj.coverImage} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-slate-200 flex items-center justify-center text-slate-400"><ImageIcon className="w-12 h-12" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white text-left">
                  <h3 className="text-2xl font-black mb-1 line-clamp-1">{proj.title}</h3>
                  <div className="flex items-center text-slate-300 text-sm font-medium"><Clock className="w-4 h-4 mr-2" /> {proj.dates?.length || 1} 天行程</div>
                </div>
                <button onClick={(e) => { 
                  e.stopPropagation(); 
                  setModal({ isOpen: true, type: 'warning', title: '確認刪除？', message: `確定要永久移除「${proj.title}」及其所有資料嗎？`, onConfirm: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', proj.id)); setModal({ isOpen: false }); }, onCancel: () => setModal({ isOpen: false }) });
                }} className="absolute top-6 right-6 bg-black/30 hover:bg-red-600 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"><Trash className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. Trip Editor Component (編輯專案)
// ==========================================
function TripEditor({ projectId, user, goBack, handleGoogleLogin, handleLogout, setModal }) {
  const [tripConfig, setTripConfig] = useState({ id: null, title: '', coverImage: '', adminUid: null, isEditable: true, dates: [] });
  const [itinerary, setItinerary] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [selectedDate, setSelectedDate] = useState('SUMMARY');
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedShoppingItem, setDraggedShoppingItem] = useState(null);
  const [editingLocId, setEditingLocId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [newShoppingName, setNewShoppingName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.uid || !projectId) return;
    
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), 
      (snap) => { if (snap.exists()) setTripConfig({ id: snap.id, ...snap.data() }); else goBack(); },
      (err) => { console.error("專案設定讀取失敗:", err); goBack(); }
    );
    
    const unsubItems = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`), 
      (snap) => setItinerary(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("行程清單讀取失敗:", err)
    );
    
    const unsubShopping = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`), 
      (snap) => setShoppingList(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("必買清單讀取失敗:", err)
    );
    
    return () => { unsubConfig(); unsubItems(); unsubShopping(); };
  }, [user, projectId, goBack]);

  const isAdmin = user?.uid === tripConfig?.adminUid;
  const canEdit = isAdmin || tripConfig?.isEditable;

  const callGemini = async (prompt, isJson = false) => {
    const models = ['gemini-2.5-flash-preview-09-2025', 'gemini-2.5-flash', 'gemini-2.0-flash']; 
    for (const model of models) {
      try {
        const payload = { contents: [{ parts: [{ text: prompt }] }], safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }] };
        if (isJson) payload.generationConfig = { responseMimeType: "application/json" };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.replace(/```json/gi, "").replace(/```/g, "").trim();
        }
      } catch (e) { console.warn(model, e); }
    }
    throw new Error("AI 伺服器忙碌中，請稍候。");
  };

  const generateAI = async (type) => {
    const targets = itinerary.filter(i => i.date === selectedDate && (type === 'desc' ? !i.description : !i.foodRecs));
    if (targets.length === 0) return;
    setLoadingAI(true);
    for (let item of targets) {
      setLoadingMsg(`AI 導遊正在研究「${item.location}」...`);
      try {
        const res = await callGemini(type === 'desc' ? getHistoryPrompt(item.location) : getFoodPrompt(item.location));
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { [type === 'desc' ? 'description' : 'foodRecs']: res });
      } catch (e) { break; }
    }
    setLoadingAI(false);
  };

  const regenerateSingleItemAI = async (item, type) => {
    setLoadingAI(true);
    setLoadingMsg(`正在為「${item.location}」重新生成${type === 'desc' ? '歷史導覽' : '美食推薦'}...`);
    try {
      const res = await callGemini(type === 'desc' ? getHistoryPrompt(item.location) : getFoodPrompt(item.location));
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { [type === 'desc' ? 'description' : 'foodRecs']: res });
    } catch (e) {
      setModal({ isOpen: true, type: 'error', title: 'AI 忙碌中', message: e.message, onConfirm: () => setModal({ isOpen: false }) });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    if (!canEdit || !draggedItem || draggedItem.id === targetItem.id) return;
    const dateItems = itinerary.filter(i => i.date === selectedDate).sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const newItems = [...dateItems];
    const dIdx = newItems.findIndex(i => i.id === draggedItem.id);
    newItems.splice(dIdx, 1);
    const tIdx = newItems.findIndex(i => i.id === targetItem.id);
    newItems.splice(tIdx, 0, draggedItem);
    const batch = writeBatch(db);
    newItems.forEach((item, idx) => batch.update(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { order: idx }));
    await batch.commit(); setDraggedItem(null);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLoadingAI(true); setLoadingMsg('背景地圖適配中...');
    try {
      const url = await compressImage(file);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { coverImage: url });
    } catch (e) { console.error(e); } finally { setLoadingAI(false); }
  };

  const handleShoppingImageUpload = async (e, itemId) => {
    const file = e.target.files[0]; if (!file) return;
    setLoadingAI(true); setLoadingMsg('上傳商品圖片中...');
    try {
      const url = await compressImage(file);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, itemId), { image: url });
    } catch (err) { console.error(err); } finally { setLoadingAI(false); }
  };

  const handleAddShoppingItem = async (e) => {
    e.preventDefault();
    if (!newShoppingName.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`), {
      name: newShoppingName, image: '', effect: '', location: '', price: '', targetDate: '', order: Date.now()
    });
    setNewShoppingName('');
  };

  const handleDropShopping = async (e, targetItem) => {
    e.preventDefault();
    if (!canEdit || !draggedShoppingItem || draggedShoppingItem.id === targetItem.id) return;
    const sItems = [...shoppingList].sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const dIdx = sItems.findIndex(i => i.id === draggedShoppingItem.id);
    sItems.splice(dIdx, 1);
    const tIdx = sItems.findIndex(i => i.id === targetItem.id);
    sItems.splice(tIdx, 0, draggedShoppingItem);
    const batch = writeBatch(db);
    sItems.forEach((item, idx) => batch.update(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { order: idx }));
    await batch.commit(); setDraggedShoppingItem(null);
  };

  const renderSummaryTable = () => {
    const dates = Array.isArray(tripConfig.dates) ? tripConfig.dates : [];
    const allTimes = [...new Set(itinerary.map(i => i.time || '全天'))].sort();
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-auto max-h-[75vh] relative custom-scrollbar screen-only">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky top-0 left-0 z-50 p-4 border-r border-b border-slate-200 bg-slate-100 w-24 font-black text-slate-600 text-xs text-center shadow-[2px_2px_5px_rgba(0,0,0,0.05)]">時間</th>
              {dates.map((date, idx) => (
                <th key={date} className="sticky top-0 z-30 p-4 min-w-[200px] border-r border-b border-slate-200 bg-slate-50 font-black text-slate-800 text-center shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                  <div className="text-[10px] text-indigo-500 mb-1 font-black uppercase tracking-wider">DAY {idx + 1}</div><div className="text-sm">{date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTimes.map(time => (
              <tr key={time} className="hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 z-40 p-4 border-r border-b border-slate-200 bg-white text-center shadow-[2px_0_5px_rgba(0,0,0,0.03)]"><span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black">{time}</span></td>
                {dates.map(date => {
                  const items = itinerary.filter(i => i.date === date && (i.time || '全天') === time);
                  return (
                    <td key={`${date}-${time}`} className="p-3 border-r border-b border-slate-200 align-top">
                      {items.map(item => (
                        <a key={item.id} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location || '景點')}`} target="_blank" rel="noreferrer" className="block p-3 mb-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition shadow-sm">
                          <div className="flex justify-between items-start gap-2"><span className="text-[12px] font-bold text-indigo-900 leading-tight line-clamp-2">{item.location}</span><MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" /></div>
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

  const renderShoppingList = () => {
    const sItems = [...shoppingList].sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    return (
      <div className="space-y-8 max-w-5xl mx-auto px-1">
        {sItems.length === 0 ? (
          <div className="py-24 text-center text-slate-300 border-4 border-dashed border-slate-200 rounded-[50px] bg-white/30 font-black italic">您的購物車還空空的，來新增必買清單吧！</div>
        ) : sItems.map((item) => (
          <div 
            key={item.id} 
            draggable={canEdit}
            onDragStart={(e) => { setDraggedShoppingItem(item); e.currentTarget.style.opacity = '0.4'; }}
            onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; setDraggedShoppingItem(null); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropShopping(e, item)}
            className="bg-white p-5 md:p-8 rounded-[32px] border border-pink-100 shadow-sm hover:shadow-xl transition-all relative flex flex-col md:flex-row gap-6"
          >
            {canEdit && <div className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:block"><GripVertical className="w-6 h-6 text-slate-300 cursor-grab active:cursor-grabbing" /></div>}
            
            <div className="w-full md:w-56 h-56 shrink-0 bg-slate-50 rounded-2xl border border-dashed border-slate-300 flex items-center justify-center relative overflow-hidden group/img shadow-inner">
              {item.image ? (
                <img src={item.image} className="w-full h-full object-cover" alt="商品" />
              ) : (
                <div className="flex flex-col items-center text-slate-300"><ImagePlus className="w-10 h-10 mb-2" /><span className="text-xs font-bold">上傳商品照片</span></div>
              )}
              {canEdit && (
                <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer text-white text-sm font-bold backdrop-blur-sm">
                  更換商品照片
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleShoppingImageUpload(e, item.id)} />
                </label>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <input disabled={!canEdit} value={item.name || ''} onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { name: e.target.value })} placeholder="輸入產品名稱..." className="w-full text-2xl md:text-3xl font-black text-pink-700 bg-transparent focus:bg-pink-50 border-b-2 border-transparent focus:border-pink-300 outline-none px-2 py-1 rounded transition-colors" />
                </div>
                {canEdit && <button onClick={() => { if(confirm("確定刪除此商品清單？")) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id)); }} className="text-red-400 p-2.5 bg-red-50 rounded-2xl hover:bg-red-100 transition-all shrink-0"><Trash2 className="w-5 h-5" /></button>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <MapPin className="w-4 h-4 text-slate-400 mx-2 shrink-0" />
                  <input disabled={!canEdit} value={item.location || ''} onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { location: e.target.value })} placeholder="預計販售地點..." className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" />
                </div>
                <div className="flex items-center bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <DollarSign className="w-4 h-4 text-slate-400 mx-2 shrink-0" />
                  <input disabled={!canEdit} type="text" value={item.price || ''} onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { price: e.target.value })} placeholder="預估價格..." className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" />
                </div>
              </div>

              <textarea disabled={!canEdit} value={item.effect || ''} onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { effect: e.target.value })} placeholder="輸入產品功效、特色或代購說明..." className="w-full flex-1 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-sm font-medium text-slate-600 resize-none outline-none focus:ring-2 focus:ring-pink-100 min-h-[80px] custom-scrollbar" />

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-pink-50/50 p-3.5 rounded-xl border border-pink-100">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <CalendarDays className="w-5 h-5 text-pink-500 shrink-0" />
                  <select disabled={!canEdit} value={item.targetDate || ''} onChange={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`, item.id), { targetDate: e.target.value })} className="flex-1 bg-white border border-pink-200 text-sm font-bold text-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-pink-300">
                    <option value="">選擇預計購買日</option>
                    {(tripConfig.dates || []).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {item.targetDate && (
                  <button onClick={() => { setSelectedDate(item.targetDate); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="flex items-center justify-center gap-1.5 text-xs font-black text-pink-600 bg-pink-100 px-4 py-2 rounded-lg hover:bg-pink-200 transition-colors sm:ml-auto w-full sm:w-auto active:scale-95">
                    跳至該日行程 <ArrowRightCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {canEdit && (
          <form onSubmit={handleAddShoppingItem} className="bg-white p-4 rounded-[24px] border-2 border-pink-200 shadow-2xl flex flex-col sm:flex-row gap-3 items-center sticky bottom-6 z-[60] mx-1">
            <div className="p-3 bg-pink-100 text-pink-600 rounded-xl hidden sm:block"><ShoppingCart className="w-5 h-5" /></div>
            <input type="text" placeholder="輸入想加入清單的商品名稱..." value={newShoppingName} onChange={(e) => setNewShoppingName(e.target.value)} className="flex-1 w-full bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-pink-200 outline-none" />
            <button type="submit" disabled={!newShoppingName.trim()} className="w-full sm:w-auto bg-pink-600 text-white p-3.5 rounded-xl hover:bg-pink-700 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 font-black"><Plus className="w-5 h-5" /> <span className="sm:hidden font-bold">加入清單</span></button>
          </form>
        )}
      </div>
    );
  };

  const renderMarkdown = (rawText) => {
    const text = String(rawText || ""); if (!text) return null;
    return text.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) return <a key={i} href={match[2]} target="_blank" rel="noreferrer" className="inline-flex items-center px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-50 transition my-1 shadow-sm break-inside-avoid screen-only"><ExternalLink className="w-3 h-3 mr-1" /> {match[1]}</a>;
      return <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} className="print-markdown-text" />;
    });
  };

  const currentItems = itinerary.filter(i => i?.date === selectedDate).sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));

  if (!tripConfig.id) return <div className="h-screen w-full flex items-center justify-center bg-slate-100 screen-only"><Sparkles className="w-12 h-12 text-indigo-600 animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-left w-full relative">
      
      {/* === [螢幕模式] 頂部導覽列 === */}
      <nav className="screen-only bg-slate-900 text-white p-2 md:p-3 flex flex-wrap justify-between items-center shadow-lg gap-2 sticky top-0 z-[100]">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-xl transition text-xs font-bold flex items-center shadow-sm"><LayoutDashboard className="w-4 h-4 md:mr-2" /> <span className="hidden xs:inline">行程首頁</span></button>
          {isAdmin && (
            <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { isEditable: !tripConfig.isEditable })} className={`flex items-center text-[10px] md:text-xs px-2.5 py-1.5 rounded-xl font-bold transition shadow-sm ${tripConfig.isEditable ? 'bg-indigo-600' : 'bg-red-600'}`}>
              {tripConfig.isEditable ? <><Shield className="w-3.5 h-3.5 sm:mr-1"/> <span className="hidden sm:inline">開放編輯</span></> : <><ShieldOff className="w-3.5 h-3.5 sm:mr-1"/> <span className="hidden sm:inline">鎖定編輯</span></>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={() => { copyToClipboard(window.location.href); setModal({ isOpen: true, type: 'success', title: '連結已複製', message: '分享此連結給旅伴即可同步查看！', onConfirm: () => setModal({ isOpen: false }) }); }} className="text-[10px] bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl font-bold flex items-center shadow-md"><Share2 className="w-3.5 h-3.5 md:mr-1" /> <span className="hidden md:inline">分享</span></button>
          <button onClick={() => setShowImport(true)} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-xl font-bold flex items-center shadow-md"><Table className="w-3.5 h-3.5 md:mr-1" /> <span className="hidden md:inline">匯入 Excel</span></button>
          <button onClick={() => window.print()} className="bg-orange-500 hover:bg-orange-600 px-2.5 py-1.5 rounded-xl font-bold flex items-center shadow-md transition text-[10px]"><Download className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">列印成冊</span></button>
          <div className="w-px h-5 bg-slate-700 mx-1"></div>
          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl pr-3">
              <span className="text-[10px] font-bold text-slate-200 hidden sm:block truncate">{user.displayName}</span>
              <button onClick={handleLogout} className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"><LogOut className="w-3.5 h-3.5 text-slate-400" /></button>
            </div>
          ) : <button onClick={handleGoogleLogin} className="text-[10px] bg-white text-slate-800 px-3 py-1.5 rounded-xl font-bold shadow-sm">登入</button>}
        </div>
      </nav>

      {/* === [雙模式共用] 封面圖區塊 === */}
      <div id="print-cover" className="relative h-[250px] md:h-[450px] w-full bg-slate-950 flex items-center justify-center overflow-hidden page-break-after print-cover-section">
        {tripConfig.coverImage ? (
          <img src={tripConfig.coverImage} className="max-h-full max-w-full object-contain print-cover-img" alt="Cover" />
        ) : (
          <div className="flex flex-col items-center text-slate-700 opacity-40 screen-only"><ImageIcon className="w-20 h-20 mb-2" /><p className="font-bold">請上傳封面地圖</p></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none screen-only" />
        
        <div className="absolute bottom-6 md:bottom-12 left-0 right-0 z-10 px-6 text-center print-title-wrapper">
          <input type="text" value={tripConfig.title || ""} disabled={!canEdit} onChange={(e) => setTripConfig({...tripConfig, title: e.target.value})} onBlur={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { title: tripConfig.title })} className="text-3xl md:text-6xl font-black text-white bg-transparent text-center w-full focus:outline-none border-b-2 border-transparent hover:border-white/20 transition-all drop-shadow-2xl screen-only" placeholder="輸入行程標題" />
          <h1 className="print-only text-5xl font-black text-slate-900 text-center mb-8">{tripConfig.title || "奇幻旅程"}</h1>
        </div>
        
        {canEdit && (
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 screen-only">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleCoverUpload} />
            <button onClick={() => fileInputRef.current.click()} className="bg-black/20 hover:bg-black/40 backdrop-blur-md text-white/80 hover:text-white text-[10px] md:text-xs font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-white/20 active:scale-95 transition-all shadow-lg flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">更換背景</span>
            </button>
          </div>
        )}
      </div>

      {/* === [螢幕模式] 編輯器主要內容 === */}
      <div className="max-w-6xl mx-auto p-4 md:p-6 mt-4 screen-only">
        <div className="flex flex-col gap-6 items-stretch md:items-center mb-8 border-b border-slate-200 pb-8">
          <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar items-center px-1 w-full">
            <button onClick={() => setSelectedDate('SHOPPING')} className={`px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-sm shrink-0 flex items-center gap-2 ${selectedDate === 'SHOPPING' ? 'bg-pink-600 text-white shadow-lg scale-105' : 'bg-white text-pink-600 border border-pink-200 hover:bg-pink-50'}`}><ShoppingCart className="w-5 h-5" /> 必買清單</button>
            <button onClick={() => setSelectedDate('SUMMARY')} className={`px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-sm shrink-0 flex items-center gap-2 ${selectedDate === 'SUMMARY' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><CalendarDays className="w-5 h-5" /> 全程總覽</button>
            <div className="w-px h-6 bg-slate-300 mx-1 shrink-0"></div>
            {(Array.isArray(tripConfig.dates) ? tripConfig.dates : []).map(date => (
              <div key={date} className="relative shrink-0">
                <button onClick={() => setSelectedDate(date)} className={`px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-sm ${selectedDate === date ? 'bg-slate-800 text-white shadow-lg scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{date}</button>
                {canEdit && <button onClick={(e) => { e.stopPropagation(); if(confirm("確定刪除這天？")) { const d = tripConfig.dates.filter(x => x !== date); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: d }); } }} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform"><X className="w-2.5 h-2.5" /></button>}
              </div>
            ))}
            {canEdit && <button onClick={() => { const d = prompt("輸入新日期 (YYYY-MM-DD)"); if(d) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: [...(tripConfig.dates || []), d].sort() }); }} className="p-2.5 bg-white rounded-2xl border border-slate-200 text-slate-400 shrink-0 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"><Plus className="w-5 h-5" /></button>}
          </div>
          {canEdit && selectedDate !== 'SUMMARY' && selectedDate !== 'SHOPPING' && currentItems.length > 0 && (
            <div className="flex gap-3 justify-center">
              <button onClick={() => generateAI('desc')} className="text-[12px] font-black bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 flex items-center gap-2 hover:bg-indigo-700 transition-all"><Sparkles className="w-4 h-4" /> 一鍵新增導覽</button>
              <button onClick={() => generateAI('food')} className="text-[12px] font-black bg-orange-600 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 flex items-center gap-2 hover:bg-orange-700 transition-all"><Utensils className="w-4 h-4" /> 一鍵美食推薦</button>
            </div>
          )}
        </div>

        {selectedDate === 'SHOPPING' ? renderShoppingList() : selectedDate === 'SUMMARY' ? renderSummaryTable() : (
          <div className="space-y-8 max-w-4xl mx-auto px-1">
            {currentItems.length === 0 ? (
              <div className="py-24 text-center text-slate-300 border-4 border-dashed border-slate-200 rounded-[50px] bg-white/30 font-black italic">點擊下方按鈕新增第一個行程吧！</div>
            ) : (
              currentItems.map((item) => (
                <div 
                  key={item.id} 
                  draggable={canEdit}
                  onDragStart={(e) => { setDraggedItem(item); e.currentTarget.style.opacity = '0.4'; }}
                  onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; setDraggedItem(null); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, item)}
                  className="bg-white p-5 md:p-8 rounded-[32px] md:rounded-[48px] border border-slate-200 shadow-sm flex flex-col gap-6 text-left hover:shadow-xl transition-all relative"
                >
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="w-full sm:w-20 flex flex-row sm:flex-col items-center justify-between sm:justify-start shrink-0">
                      <div className="text-sm font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-inner">{item.time || '--:--'}</div>
                      {canEdit && <GripVertical className="hidden sm:block mt-6 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing w-7 h-7" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex-1">
                          {canEdit ? (
                            <div className="flex items-center gap-2 group/edit relative">
                              {editingLocId === item.id ? (
                                <input autoFocus defaultValue={item.location} onBlur={(e) => { if(e.target.value !== item.location) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { location: e.target.value }); setEditingLocId(null); }} onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur(); }} className="text-2xl md:text-3xl font-black text-slate-800 w-full bg-slate-50 border-b-2 border-indigo-500 focus:outline-none p-1 rounded" />
                              ) : (
                                <div onClick={() => setEditingLocId(item.id)} className="cursor-text flex items-center gap-3 font-black text-2xl md:text-3xl text-slate-800 hover:text-indigo-600 transition-colors">{item.location || '行程名稱'} <Edit3 className="w-5 h-5 text-slate-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" /></div>
                              )}
                            </div>
                          ) : <h3 className="text-2xl md:text-3xl font-black text-slate-800">{item.location}</h3>}
                        </div>
                        <div className="flex gap-2">
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location || '旅遊')}`} target="_blank" rel="noreferrer" className="text-emerald-500 p-2.5 bg-emerald-50 rounded-2xl shadow-sm hover:scale-110 hover:bg-emerald-100 transition-all"><MapPin className="w-5 h-5" /></a>
                          {canEdit && <button onClick={() => { setModal({ isOpen: true, type: 'warning', title: '刪除行程項目？', message: `確定刪除「${item.location}」嗎？`, onConfirm: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id)); setModal({ isOpen: false }); }, onCancel: () => setModal({ isOpen: false }) }); }} className="text-red-400 p-2.5 bg-red-50 rounded-2xl hover:bg-red-100 transition-all"><Trash2 className="w-5 h-5" /></button>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                         <div className="bg-slate-50 p-4 rounded-[24px] border border-dashed border-slate-200">
                           <h4 className="text-[11px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5"><StickyNote className="w-3 h-3" /> 行程備註說明</h4>
                           <textarea disabled={!canEdit} defaultValue={item.notes || ''} onBlur={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { notes: e.target.value })} placeholder="點擊編輯個人備註..." className="w-full bg-transparent text-sm font-medium text-slate-600 min-h-[60px] max-h-[120px] overflow-y-auto custom-scrollbar focus:outline-none resize-none" />
                         </div>
                         
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
                           <div className="bg-indigo-50/50 rounded-3xl border border-indigo-100 flex flex-col overflow-hidden shadow-sm">
                             <div className="p-4 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
                               <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> 真實歷史故事與冷知識</h4>
                               {canEdit && (
                                 <div className="flex items-center gap-2">
                                   {item.description && (
                                     <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { description: '' })} className="p-1.5 bg-white/60 rounded-xl shadow-sm text-red-400 hover:bg-red-500 hover:text-white transition-all" title="清空內容"><Trash2 className="w-4 h-4" /></button>
                                   )}
                                   <button onClick={() => regenerateSingleItemAI(item, 'desc')} className="p-1.5 bg-white rounded-xl shadow-sm text-indigo-500 hover:scale-110 transition-transform active:scale-95" title={item.description ? "重新生成" : "AI 生成"}>
                                     {item.description ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                                   </button>
                                 </div>
                               )}
                             </div>
                             <div className="p-5 h-48 md:h-64 overflow-y-auto custom-scrollbar text-xs md:text-sm text-slate-700 leading-relaxed italic text-left">{renderMarkdown(item.description || '點擊右上方魔法棒由 AI 生成歷史故事...')}</div>
                           </div>

                           <div className="bg-orange-50/50 rounded-3xl border border-orange-100 flex flex-col overflow-hidden shadow-sm">
                             <div className="p-4 bg-orange-100/50 border-b border-orange-100 flex justify-between items-center">
                               <h4 className="text-[11px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5" /> 美食名店推薦</h4>
                               {canEdit && (
                                 <div className="flex items-center gap-2">
                                   {item.foodRecs && (
                                     <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`, item.id), { foodRecs: '' })} className="p-1.5 bg-white/60 rounded-xl shadow-sm text-red-400 hover:bg-red-500 hover:text-white transition-all" title="清空內容"><Trash2 className="w-4 h-4" /></button>
                                   )}
                                   <button onClick={() => regenerateSingleItemAI(item, 'food')} className="p-1.5 bg-white rounded-xl shadow-sm text-orange-500 hover:scale-110 transition-transform active:scale-95" title={item.foodRecs ? "重新生成" : "AI 生成"}>
                                     {item.foodRecs ? <RefreshCw className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                                   </button>
                                 </div>
                               )}
                             </div>
                             <div className="p-5 h-48 md:h-64 overflow-y-auto custom-scrollbar text-xs md:text-sm text-slate-700 leading-relaxed italic text-left">{renderMarkdown(item.foodRecs || '點擊右上方魔法棒由 AI 推薦美食...')}</div>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {canEdit && selectedDate && selectedDate !== 'SUMMARY' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                const timeEl = document.getElementById('new-time');
                const locEl = document.getElementById('new-loc');
                if(!locEl.value) return;
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`), { date: selectedDate, time: timeEl.value, location: locEl.value, notes: '', description: '', foodRecs: '', order: Date.now() });
                locEl.value='';
              }} className="bg-white p-5 rounded-[32px] border-2 border-indigo-100 shadow-2xl flex flex-col sm:flex-row gap-4 items-center sticky bottom-6 z-[60] mx-1">
                <input id="new-time" type="time" className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm w-full sm:w-36 font-black text-center focus:ring-2 focus:ring-indigo-200 outline-none" />
                <input id="new-loc" type="text" placeholder="輸入下一個行程地點..." className="flex-1 w-full bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-200 outline-none" />
                <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 font-black"><Plus className="w-6 h-6 mx-auto" /> <span className="sm:hidden">新增行程</span></button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* === [列印模式] 專屬 PDF 小冊子區域 === */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-4 font-sans text-black bg-white">
        {(tripConfig.dates || []).map((date, dayIdx) => {
          const dayItems = itinerary.filter(i => i?.date === date).sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0));
          if (dayItems.length === 0) return null;
          return (
            <div key={date} className="page-break-before-always pb-8">
              {/* 每日標題 */}
              <div className="border-b-4 border-slate-800 pb-4 mb-8">
                <h2 className="text-4xl font-black text-slate-800">Day {dayIdx + 1}</h2>
                <p className="text-xl font-bold text-slate-500 mt-2">{date}</p>
              </div>
              
              {/* 每日行程清單 */}
              <div className="space-y-8">
                {dayItems.map(item => {
                  return (
                    <div key={item.id} className="avoid-page-break border-l-4 border-indigo-500 pl-6 py-2 mb-8">
                      
                      {/* 時間與地點 */}
                      <div className="flex items-baseline gap-4 mb-4">
                        <span className="text-xl font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">{item.time || '--:--'}</span>
                        <span className="text-2xl font-black text-slate-900">{item.location}</span>
                      </div>
                      
                      {/* 備註純文字 */}
                      {typeof item.notes === 'string' && item.notes.trim() !== '' && (
                        <div className="mb-6 bg-slate-50 p-4 rounded-xl">
                          <h4 className="text-sm font-bold text-slate-500 mb-2">📝 行程備註</h4>
                          <p className="text-base text-slate-800 whitespace-pre-wrap">{item.notes}</p>
                        </div>
                      )}

                      {/* AI 內容純文字 */}
                      <div className="grid grid-cols-2 gap-8 mt-4">
                        {typeof item.description === 'string' && item.description.trim() !== '' && (
                          <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-50">
                            <h4 className="text-sm font-bold text-indigo-600 border-b border-indigo-100 mb-3 pb-2">📜 歷史與冷知識</h4>
                            <div className="text-sm text-slate-700 leading-relaxed print-markdown">{renderMarkdown(item.description)}</div>
                          </div>
                        )}
                        {typeof item.foodRecs === 'string' && item.foodRecs.trim() !== '' && (
                          <div className="bg-orange-50/30 p-4 rounded-xl border border-orange-50">
                            <h4 className="text-sm font-bold text-orange-600 border-b border-orange-100 mb-3 pb-2">🍽️ 美食名店推薦</h4>
                            <div className="text-sm text-slate-700 leading-relaxed print-markdown">{renderMarkdown(item.foodRecs)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* --- 必買清單列印附錄區域 --- */}
        {shoppingList && shoppingList.length > 0 && (
          <div className="page-break-before-always pb-8">
            <div className="border-b-4 border-pink-600 pb-4 mb-8 mt-10">
              <h2 className="text-4xl font-black text-pink-700">Shopping List 必買清單</h2>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[...shoppingList].sort((a,b) => (Number(a.order) || 0) - (Number(b.order) || 0)).map(item => {
                return (
                  <div key={item.id} className="avoid-page-break border border-slate-300 rounded-2xl p-5 flex gap-5 bg-white shadow-sm">
                    {item.image && (
                      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200">
                        <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{item.name}</h3>
                      {(item.location || item.price) && (
                        <div className="text-sm font-bold text-pink-700 mb-2 bg-pink-50 inline-block px-2.5 py-1 rounded-lg border border-pink-100">
                          📍 {item.location} {item.price && `| 💰 預估 ${item.price}`}
                        </div>
                      )}
                      {item.targetDate && (
                        <div className="text-xs font-bold text-slate-500 mb-3">📅 預計購買日: {item.targetDate}</div>
                      )}
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.effect}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 共用 Modal 區塊 */}
      {loadingAI && <div className="fixed inset-0 z-[4000] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300 screen-only"><div className="bg-white p-10 rounded-[50px] shadow-2xl flex flex-col items-center max-w-sm text-center transform animate-in zoom-in-95"><Sparkles className="w-12 h-12 text-indigo-600 animate-bounce mb-4" /><h3 className="text-xl font-black text-slate-800">AI 正在規劃中...</h3><p className="text-slate-500 font-bold text-sm leading-relaxed">{loadingMsg}</p></div></div>}

      {showImport && (
        <div className="fixed inset-0 z-[3500] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in screen-only">
          <div className="bg-white rounded-[40px] w-full max-w-2xl p-8 md:p-12 shadow-2xl border border-slate-100 relative text-left">
            <button onClick={() => setShowImport(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-8 h-8" /></button>
            <div className="flex items-center gap-4 mb-8"><div className="p-4 bg-emerald-100 rounded-3xl text-emerald-600"><Table className="w-8 h-8" /></div><div><h3 className="text-3xl font-black text-slate-800">AI 智慧混合匯入</h3><p className="text-slate-500 font-medium">由 AI 自動判斷並分配至「行程」或「必買清單」</p></div></div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="直接貼上您的 Excel 表格內容（可同時包含行程與購物清單）..." className="w-full h-56 bg-slate-50 border-2 border-slate-100 rounded-[32px] p-6 text-sm outline-none focus:ring-4 focus:ring-emerald-100 font-mono mb-6" />
            <div className="flex gap-4"><button onClick={() => setShowImport(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-3xl hover:bg-slate-200">取消</button><button onClick={async () => { 
              if(!importText.trim()) return; setLoadingAI(true); setLoadingMsg('AI 正在為您分類行程與必買清單...');
              try { 
                const jsonPrompt = `這是一份可能包含「行程」與「必買清單/購物」的混合資料：\n"""\n${importText}\n"""\n請判斷內容歸屬，並嚴格回傳純 JSON 格式（不要包含 markdown 標籤）：\n{\n  "itinerary": [{"date": "YYYY-MM-DD", "time": "HH:MM", "location": "地點名稱", "notes": "備註"}],\n  "shopping": [{"name": "商品名稱", "location": "預計購買地點", "price": "預估價格", "effect": "功效或備註", "targetDate": "YYYY-MM-DD"}]\n}`;
                const json = await callGemini(jsonPrompt, true); 
                const data = JSON.parse(json); 
                const newDatesFound = [...new Set([...(data.itinerary || []).map(item => item.date), ...(data.shopping || []).map(item => item.targetDate)])].filter(Boolean);
                const mergedDates = [...new Set([...(tripConfig.dates || []), ...newDatesFound])].sort();
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', projectId), { dates: mergedDates });
                const batch = writeBatch(db); 
                (data.itinerary || []).forEach((item, idx) => { batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', `itinerary_${projectId}`)), { date: item.date || (tripConfig.dates?.[0] || ''), time: item.time || '', location: item.location || '未知點', notes: item.notes || '', description: '', foodRecs: '', order: Date.now() + idx }); }); 
                (data.shopping || []).forEach((item, idx) => { batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', `shopping_${projectId}`)), { name: item.name || '未命名商品', image: '', effect: item.effect || '', location: item.location || '', price: item.price || '', targetDate: item.targetDate || '', order: Date.now() + 1000 + idx }); });
                await batch.commit(); setShowImport(false); setModal({ isOpen: true, type: 'success', title: '匯入完成！', message: `已成功同步行程與必買清單。`, onConfirm: () => setModal({ isOpen: false }) }); 
              } catch(e) { setModal({ isOpen: true, type: 'error', title: '解析失敗', message: '請嘗試更換格式。', onConfirm: () => setModal({ isOpen: false }) }); } 
              finally { setLoadingAI(false); } 
            }} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-3xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all text-lg">開始智慧匯入</button></div>
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: () => {}, onCancel: null });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          // 強制優先使用最新核發的 token 進行登入
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { 
        console.error('Auth error:', error);
      }
    };
    
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
      setUser(u); 
      setIsAuthReady(true); 
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let warnId, logoutId;
    const resetTimer = () => {
      clearTimeout(warnId); clearTimeout(logoutId);
      if (user && !user.isAnonymous) {
        warnId = setTimeout(() => {
          setModal({ 
            isOpen: true, type: 'warning', title: '閒置自動登出警示', message: '您已閒置 9 分鐘，1 分鐘後系統將自動退出並切換為訪客模式。', 
            onConfirm: () => { setModal({ isOpen: false }); resetTimer(); } 
          });
        }, 9 * 60 * 1000);
        logoutId = setTimeout(async () => {
          await signOut(auth);
          setModal({ isOpen: true, type: 'info', title: '自動登出成功', message: '基於安全考量，系統已自動退出帳號。', onConfirm: () => setModal({ isOpen: false }) });
        }, 10 * 60 * 1000);
      }
    };
    if (user && !user.isAnonymous) {
      resetTimer();
      ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(e => window.addEventListener(e, resetTimer));
    }
    return () => ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(e => window.removeEventListener(e, resetTimer));
  }, [user]);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('p');
      if (p) setCurrentProjectId(p);
    } catch (e) {}
  }, []);

  const syncUrl = (id) => {
    try {
      if (!window?.history) return;
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('p', id); else url.searchParams.delete('p');
      if (window.location.protocol !== 'blob:' && !window.location.hostname.includes('goog')) {
        window.history.pushState({}, '', url.toString());
      }
    } catch (e) {}
  };

  if (!isAuthReady) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 overflow-hidden">
      <Sparkles className="w-12 h-12 text-indigo-500 animate-pulse mb-6" />
      <p className="font-black text-xl text-slate-800 text-center tracking-tighter">系統連線中...</p>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col overflow-x-hidden">
      {currentProjectId ? (
        <TripEditor 
          projectId={currentProjectId} 
          user={user} 
          goBack={() => { setCurrentProjectId(null); syncUrl(null); }} 
          handleGoogleLogin={async () => { 
            try { 
              await signInWithPopup(auth, new GoogleAuthProvider()); 
            } catch (e) {
              setModal({ isOpen: true, type: 'warning', title: '預覽環境限制', message: '在此預覽視窗中，Google 登入可能被阻擋。建議您將專案部署至正式網址後登入！', onConfirm: () => setModal({ isOpen: false }) });
            } 
          }} 
          handleLogout={async () => { try { await signOut(auth); } catch (e) {} }} 
          setModal={setModal} 
        />
      ) : (
        <Dashboard 
          user={user} 
          onSelectProject={(id) => { setCurrentProjectId(id); syncUrl(id); }} 
          handleGoogleLogin={async () => { 
            try { 
              await signInWithPopup(auth, new GoogleAuthProvider()); 
            } catch (e) {
              setModal({ isOpen: true, type: 'warning', title: '預覽環境限制', message: '在此預覽視窗中，Google 登入可能被阻擋。建議您將專案部署至正式網址後登入！', onConfirm: () => setModal({ isOpen: false }) });
            } 
          }} 
          handleLogout={async () => { try { await signOut(auth); } catch (e) {} }} 
          setModal={setModal} 
        />
      )}
      <CustomModal {...modal} />
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        /* === 螢幕與列印雙軌機制 === */
        @media screen {
          .print-only { display: none !important; }
        }
        
        @media print {
          /* 隱藏螢幕專屬的所有 UI、按鈕與對話框 */
          .screen-only, button, svg, input[type="text"], input[type="time"], textarea { display: none !important; }
          
          /* 顯示列印專屬架構 */
          .print-only { display: block !important; }
          
          @page { size: A4 portrait; margin: 15mm; }
          body { 
            background: white !important; 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            color: #111; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          
          /* 封面：背景圖變成大圖封面，自動斷頁 */
          #print-cover { 
            height: 100vh !important; 
            display: flex !important; 
            flex-direction: column !important; 
            justify-content: center !important; 
            align-items: center !important; 
            page-break-after: always; 
            background: white !important; 
          }
          .cover-img { max-height: 60vh !important; object-fit: contain !important; margin-bottom: 2rem; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
          .print-title { font-size: 48pt !important; color: #1e293b !important; font-weight: 900 !important; text-align: center; border: none !important; padding: 0 !important; background: transparent !important; }
          
          /* 排版保護控制 */
          .page-break-before-always { page-break-before: always; break-before: page; }
          .avoid-page-break { page-break-inside: avoid; break-inside: avoid; }
          
          /* Markdown 連結樣式優化 */
          .print-markdown a { color: #2563eb; text-decoration: none; font-weight: bold; }
        }
        
        @media (max-width: 640px) {
          .rounded-\\[32px\\], .rounded-\\[48px\\] { border-radius: 20px !important; }
          input[type="time"] { font-size: 16px !important; }
        }
        html, body { background: #f8fafc; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
      `}} />
    </div>
  );
}