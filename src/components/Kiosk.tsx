/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Ticket, 
  Printer, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Edit3, 
  Plus, 
  Trash2, 
  Sparkles, 
  X, 
  Save, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ticket as TicketType, CategoryConfig, Counter } from '../types';
import { apiFetch } from '../utils/network';

interface KioskProps {
  issuancePaused: boolean;
  onIssueTicket: (category: string) => Promise<TicketType | null>;
  waitingCount: number;
  categories?: CategoryConfig[];
  departmentTitle?: string;
  counters?: Counter[];
  onRefreshState?: () => void;
}

export const Kiosk: React.FC<KioskProps> = ({
  issuancePaused,
  onIssueTicket,
  waitingCount,
  categories: customCategories,
  departmentTitle,
  counters = [],
  onRefreshState
}) => {
  const defaultCategories: CategoryConfig[] = [
    {
      id: 'special',
      prefix: 'A',
      name: 'توثيق وكالة',
      desc: 'تنجز هذه المعاملة أمام مندوب رئيس الفرع للتثبت من الهوية و محتويات الوكالة',
      assignedCounterId: 'counter-1791640234085',
      assignedCounterName: 'الشباك 1'
    },
    {
      id: 'cat_1791641888137',
      name: 'الحصول على صورة عن وكالة',
      prefix: 'B',
      desc: ''
    },
    {
      id: 'cat_1791677992936',
      name: 'عزل وكالة',
      prefix: 'C',
      desc: 'لعزل وكالة محامي يتطلب وجود صورة عن الوكالة أو رقمها ودفع رسم العزل وتبليغ المحامي المعزول والتأشير بوقوع العزل على الوكالة المعزولة .'
    }
  ];

  const categories = customCategories && customCategories.length > 0 ? customCategories : defaultCategories;
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || 'general');
  const [lastIssuedTicket, setLastIssuedTicket] = useState<TicketType | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHeader, setShowHeader] = useState(false);
  const [isQueueManagementActive, setIsQueueManagementActive] = useState(false);

  // Toggle header with F1
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setShowHeader((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Manager Edit Category Modal State
  const [editingCategory, setEditingCategory] = useState<CategoryConfig | null>(null);
  const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrefix, setFormPrefix] = useState('A');
  const [formId, setFormId] = useState('');
  const [formPin, setFormPin] = useState('9999');
  const [savingLoading, setSavingLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const categoryColors: Record<string, string> = {
    A: 'border-amber-500 bg-amber-50 text-amber-900',
    B: 'border-blue-500 bg-blue-50 text-blue-900',
    C: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    D: 'border-purple-500 bg-purple-50 text-purple-900',
    E: 'border-rose-500 bg-rose-50 text-rose-900',
    F: 'border-cyan-500 bg-cyan-50 text-cyan-900'
  };

  // Preset services suggestions requested by user
  const presetServiceNames = [
    { name: 'توثيق وكالة', desc: 'تنظيم وتوثيق الوكالات العامة والخاصة وتثبيتها أصولاً' },
    { name: 'الحصول على صورة عن وكالة', desc: 'سحب واستخراج صورة مصدقة طبق الأصل عن وكالة محفوظة في الأرشيف' },
    { name: 'تنظيم وكالة خاصة', desc: 'وكالات البيع والفراغ وإدارة الأملاك والمركبات' },
    { name: 'تصديق العقود والاتفاقيات', desc: 'تصديق وتثبيت العقود والاتفاقيات القانونية' },
    { name: 'الاستعلامات والدعم النقابي', desc: 'الاستعلام عن الأوراق المطلوبة والرسوم وسندات التوكيل' }
  ];

  const handleGetTicket = async () => {
    if (issuancePaused) return;
    setIsIssuing(true);
    try {
      const ticket = await onIssueTicket(selectedCategory);
      if (ticket) {
        setLastIssuedTicket(ticket);
        setShowModal(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
        playBeep();
        // Direct print ticket immediately
        printTicketDirectly(ticket);
        setTimeout(() => {
          setShowModal(false);
        }, 5000);
      }
    } catch (err) {
      console.error('Failed to issue ticket', err);
    } finally {
      setIsIssuing(false);
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // AudioContext might be blocked before user interaction
    }
  };

  const printTicketDirectly = (ticket: TicketType) => {
    try {
      const assignedCounterObj = counters.find(c => c.id === ticket.counterId) ||
        counters.find(c => {
          const cat = categories.find(catItem => catItem.id === ticket.category);
          return cat?.assignedCounterId === c.id;
        }) ||
        counters.find(c => {
          const match = c.name.match(/\((.*?)\)/);
          const task = match ? match[1].trim() : c.name.replace(/^الشباك\s*\d+\s*[-:]?\s*/, '').trim();
          return task === ticket.categoryNameArabic || c.name === ticket.categoryNameArabic || ticket.categoryNameArabic.includes(task);
        });
      const counterDisplay = ticket.counterName || assignedCounterObj?.name || 'شباك الخدمة المتاح';

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>تذكرة دور - ${ticket.displayNumber}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 4mm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                width: 72mm;
                margin: 0 auto;
                padding: 4mm 2mm;
                text-align: center;
                color: #000;
                background: #fff;
                direction: rtl;
              }
              .header-title {
                font-size: 16px;
                font-weight: 900;
                margin-bottom: 2px;
              }
              .header-subtitle {
                font-size: 12px;
                font-weight: 700;
                color: #333;
                margin-bottom: 6px;
              }
              .divider {
                border-top: 2px dashed #000;
                margin: 8px 0;
              }
              .category-title {
                font-size: 15px;
                font-weight: 800;
                margin: 6px 0;
                padding: 4px;
                background: #f0f0f0;
                border-radius: 4px;
              }
              .ticket-number {
                font-size: 46px;
                font-weight: 900;
                font-family: monospace, sans-serif;
                letter-spacing: 2px;
                margin: 8px 0;
                line-height: 1;
              }
              .counter-assigned {
                font-size: 14px;
                font-weight: 900;
                margin: 6px 0;
                padding: 3px;
                background: #fef3c7;
                border-radius: 4px;
              }
              .waiting-info {
                font-size: 13px;
                font-weight: 800;
                margin: 6px 0;
              }
              .datetime-row {
                font-size: 11px;
                color: #333;
                display: flex;
                justify-content: space-between;
                margin-top: 8px;
              }
              .footer-msg {
                font-size: 11px;
                margin-top: 10px;
                font-weight: 700;
              }
            </style>
          </head>
          <body>
            <div class="header-title">${departmentTitle || 'نقابة المحامين بحلب'}</div>
            <div class="header-subtitle">دائرة الوكالات - نظام إدارة الدور</div>
            <div class="divider"></div>
            <div class="category-title">${ticket.categoryNameArabic}</div>
            <div class="ticket-number">${ticket.displayNumber}</div>
            <div class="counter-assigned">الشباك المخصص: ${counterDisplay}</div>
            <div class="waiting-info">عدد المنتظرين في الطابور: ${waitingCount}</div>
            <div class="divider"></div>
            <div class="datetime-row">
              <span>التاريخ: ${new Date().toLocaleDateString('ar-SY')}</span>
              <span>الوقت: ${new Date(ticket.createdAt || Date.now()).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="footer-msg">يرجى التوجه للشباك المخصص عند سماع النداء</div>
          </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            window.print();
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }, 150);
      }
    } catch (err) {
      console.error('Direct print failed, using standard window.print', err);
      setTimeout(() => {
        window.print();
      }, 100);
    }
  };

  const handlePrint = () => {
    if (lastIssuedTicket) {
      printTicketDirectly(lastIssuedTicket);
    } else {
      window.print();
    }
  };

  // Open Edit Modal for a category
  const handleOpenEditCategory = (cat: CategoryConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCategory(cat);
    setIsNewCategory(false);
    setFormId(cat.id);
    setFormName(cat.name);
    setFormDesc(cat.desc || '');
    setFormPrefix(cat.prefix || 'A');
    setSaveError('');
    setShowCategoryEditModal(true);
  };

  // Open Add Modal for a new category
  const handleOpenAddCategory = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCategory(null);
    setIsNewCategory(true);
    setFormId(`cat_${Date.now()}`);
    setFormName('');
    setFormDesc('');
    const nextPrefixChar = String.fromCharCode(65 + categories.length);
    setFormPrefix(nextPrefixChar);
    setSaveError('');
    setShowCategoryEditModal(true);
  };

  // Save Category changes
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setSaveError('يرجى إدخال اسم الخدمة.');
      return;
    }

    setSavingLoading(true);
    setSaveError('');

    try {
      const token = sessionStorage.getItem('agency_admin_token') || localStorage.getItem('agency_admin_token') || 'admin-token-master';
      const pin = formPin.trim() || '9999';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-admin-token': token,
        'x-admin-pin': pin
      };

      if (isNewCategory) {
        // Add new category
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: formId || `cat_${Date.now()}`,
            name: trimmedName,
            prefix: formPrefix.trim().toUpperCase() || 'A',
            desc: formDesc.trim()
          })
        });
        showToast('success', `تم حفظ التعديل بنجاح: تمت إضافة خدمة (${trimmedName}) إلى جهاز إصدار التذاكر.`);
      } else if (editingCategory) {
        // Update existing category
        await apiFetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: trimmedName,
            prefix: formPrefix.trim().toUpperCase() || editingCategory.prefix,
            desc: formDesc.trim()
          })
        });
        showToast('success', `تم حفظ التعديل بنجاح: تم تحديث اسم الخدمة إلى (${trimmedName}) في جهاز إصدار التذاكر.`);
      }

      setShowCategoryEditModal(false);
      onRefreshState?.();
    } catch (err: any) {
      setSaveError(err.message || 'حدث خطأ أثناء حفظ اسم الخدمة. تأكد من رمز المدير العام.');
    } finally {
      setSavingLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: CategoryConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (categories.length <= 1) {
      showToast('error', 'يجب إبقاء خدمة واحدة على الأقل في جهاز الإصدار.');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف خدمة "${cat.name}" من جهاز إصدار التذاكر؟`)) {
      return;
    }

    try {
      const token = sessionStorage.getItem('agency_admin_token') || localStorage.getItem('agency_admin_token') || 'admin-token-master';
      const pin = formPin.trim() || '9999';

      await apiFetch(`/api/admin/categories/${cat.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-admin-token': token,
          'x-admin-pin': pin
        }
      });

      showToast('success', `تم حفظ التعديل: تم حذف خدمة (${cat.name}) من جهاز إصدار الدور.`);
      onRefreshState?.();
    } catch (err: any) {
      showToast('error', err.message || 'تعذر حذف الخدمة.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-500 shadow-emerald-900/30 ring-2 ring-emerald-500/30'
              : 'bg-red-900 text-white border-red-500 shadow-red-900/30'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      {showHeader && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl border border-amber-500/30 text-center space-y-3">
          <div className="w-16 h-16 bg-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-amber-400">
            <Ticket className="w-9 h-9 text-white" />
          </div>
          <p className="text-white text-lg font-bold">دائرة الوكالات نقابة المحامين بحلب</p>
          
          {/* Queue Management Toggle Button */}
          {!isQueueManagementActive && (
            <button
              onClick={() => setIsQueueManagementActive(true)}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold transition-colors"
            >
              إدارة الدور
            </button>
          )}
        </div>
      )}

      {!isQueueManagementActive && (
        <>
          {/* Toast Banner */}
          {toastMessage && (
            <div
              className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-500 shadow-emerald-900/30 ring-2 ring-emerald-500/30'
                  : 'bg-red-900 text-white border-red-500 shadow-red-900/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {toastMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{toastMessage.text}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {issuancePaused ? (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center space-y-4">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-red-900">إصدار التذاكر متوقف مؤقتًا</h2>
              <p className="text-red-700 text-sm">تم إيقاف إصدار التذاكر مؤقتًا من قبل مسؤول الدائرة. يرجى مراجعة الموظف المسؤول.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800">اختر نوع الخدمة المطلوبة:</h2>
                <span className="text-xs text-slate-500">عدد الخدمات المتاحة: {categories.length}</span>
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map((cat) => {
                  const assignedCounter = counters.find(c => c.id === cat.assignedCounterId) ||
                    counters.find(c => {
                      const match = c.name.match(/\((.*?)\)/);
                      const task = match ? match[1].trim() : c.name.replace(/^الشباك\s*\d+\s*[-:]?\s*/, '').trim();
                      return task === cat.name || c.name === cat.name || cat.name.includes(task);
                    });

                  const handleIssueThisTicket = async () => {
                    if (issuancePaused || isIssuing) return;
                    setSelectedCategory(cat.id);
                    setIsIssuing(true);
                    try {
                      const ticket = await onIssueTicket(cat.id);
                      if (ticket) {
                        setLastIssuedTicket(ticket);
                        setShowModal(true);
                        confetti({
                          particleCount: 50,
                          spread: 60,
                          origin: { y: 0.7 }
                        });
                        playBeep();
                        printTicketDirectly(ticket);
                        setTimeout(() => {
                          setShowModal(false);
                        }, 5000);
                      }
                    } catch (err) {
                      console.error('Failed to issue ticket', err);
                    } finally {
                      setIsIssuing(false);
                    }
                  };

                  return (
                    <div
                      key={cat.id}
                      className="p-6 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-4 border-slate-200 bg-white hover:border-amber-400 hover:shadow-md shadow-sm relative group"
                    >
                      {/* Main clickable area to issue ticket */}
                      <div 
                        onClick={handleIssueThisTicket}
                        className="cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className={`w-11 h-11 rounded-xl font-mono font-black text-xl flex items-center justify-center border shadow-xs ${categoryColors[cat.prefix] || 'border-slate-300 bg-slate-50 text-slate-900'}`}>
                              {cat.prefix}
                            </span>
                            <div className="font-extrabold text-slate-900 text-lg leading-snug">
                              {cat.name}
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-1 rounded-lg font-bold">
                            انقر للقطع الفوري 🎫
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-500">{cat.desc || 'لا يوجد وصف محدد لهذه الخدمة'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Ticket Modal / Print View */}
      {showModal && lastIssuedTicket && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in fade-in zoom-in duration-200">
            
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-1 rounded-full text-xs font-bold animate-pulse">
                <Printer className="w-3.5 h-3.5 text-emerald-700 animate-bounce" />
                جاري طباعة البطاقة مباشرة للزبون...
              </div>
              <h3 className="text-xl font-bold text-slate-800">تم إصدار وطباعة تذكرتك بنجاح</h3>
              <p className="text-xs text-slate-500">يرجى استلام التذكرة المطبوعة والانتظار حتى ظهور رقمك على الشاشة</p>
            </div>

            {/* Physical Ticket Simulator Card */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 space-y-4 shadow-inner text-center">
              <div className="text-xs font-bold text-slate-600">{departmentTitle || 'نقابة المحامين بحلب - دائرة الوكالات'}</div>
              
              <div className="py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 mb-1">{lastIssuedTicket.categoryNameArabic}</div>
                <div className="text-5xl font-black font-mono tracking-wider text-amber-700">
                  {lastIssuedTicket.displayNumber}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between px-2">
                <span>التاريخ: {new Date().toLocaleDateString('ar-SY')}</span>
                <span>الوقت: {new Date(lastIssuedTicket.createdAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                <Printer className="w-4 h-4" /> إعادة طباعة التذكرة
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all text-sm shadow-md"
              >
                تم / تذكرة جديدة
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
