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
    { id: 'general', name: 'توثيق وكالة', desc: 'تنظيم وتوثيق الوكالات العامة والخاصة وتثبيتها أصولاً', prefix: 'A' },
    { id: 'copy', name: 'الحصول على صورة عن وكالة', desc: 'سحب واستخراج صورة مصدقة طبق الأصل عن وكالة محفوظة', prefix: 'B' },
    { id: 'special', name: 'تنظيم وكالة خاصة', desc: 'وكالات البيع، الفراغ، الإدارة، والتصرف العقاري والمركبات', prefix: 'C' },
    { id: 'attestation', name: 'تصديق العقود والاستعلامات', desc: 'تصديق وتثبيت العقود والاتفاقيات والاستعلام عن الرسوم النقابية', prefix: 'D' },
  ];

  const categories = customCategories && customCategories.length > 0 ? customCategories : defaultCategories;
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || 'general');
  const [lastIssuedTicket, setLastIssuedTicket] = useState<TicketType | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
      <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl border border-amber-500/30 text-center space-y-3">
        <div className="w-16 h-16 bg-amber-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-amber-400">
          <Ticket className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">جهاز إصدار تذاكر الدور</h1>
        <p className="text-slate-300 text-sm">{departmentTitle || 'دائرة الوكالات – نقابة المحامين بحلب'}</p>
        <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full text-xs text-slate-300 border border-slate-700">
          <Clock className="w-4 h-4 text-amber-400" />
          المراجعين المنتظرين حالياً في الصالة: <strong className="text-white font-mono text-sm">{waitingCount}</strong> مراجع
        </div>
      </div>

      {/* Manager Quick Service Customizer Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs text-slate-700 text-right w-full sm:w-auto">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 block">إدارة خدمات جهاز الإصدار:</span>
            <span className="text-[11px] text-slate-500">إضافة أو حذف الخدمات المعروضة للمراجعين في قاعة الانتظار</span>
          </div>
        </div>
        <button
          onClick={handleOpenAddCategory}
          className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> إضافة خدمة جديدة لجهاز الإصدار
        </button>
      </div>

      {issuancePaused ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-red-900">إصدار التذاكر متوقف مؤقتًا</h2>
          <p className="text-red-700 text-sm">تم إيقاف إصدار التذاكر مؤقتًا من قبل مسؤول الدائرة. يرجى مراجعة الموظف المسؤول.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Top Banner: Services Assigned to Counters */}
          {counters && counters.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white border-2 border-amber-300 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>الخدمات وتوزيع الشبابيك المسندة إليها حالياً في الصالة:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {counters.map(counter => {
                  const assignedCat = categories.find(c => c.assignedCounterId === counter.id) ||
                    categories.find(c => {
                      const match = counter.name.match(/\((.*?)\)/);
                      const task = match ? match[1].trim() : counter.name.replace(/^الشباك\s*\d+\s*[-:]?\s*/, '').trim();
                      return task === c.name || counter.name === c.name || c.name.includes(task);
                    });
                  return (
                    <div
                      key={counter.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-200 shadow-xs text-xs"
                    >
                      <span className="font-bold text-slate-800">{counter.name}:</span>
                      <strong className="text-amber-800 font-black">
                        {assignedCat ? assignedCat.name : 'كافة المعاملات'}
                      </strong>
                      <span
                        className={`w-2 h-2 rounded-full ${counter.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={counter.isOpen ? 'متاح' : 'مغلق'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

            {/* Big Action Button (Removed as per user request to use service buttons directly) */}
            <div className="pt-2 hidden">
              <button
                onClick={handleGetTicket}
                disabled={isIssuing}
                className="w-full py-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-2xl sm:text-3xl rounded-2xl shadow-xl hover:shadow-2xl transition-all transform active:scale-95 flex items-center justify-center gap-4 border border-amber-400/50"
              >
                <Ticket className="w-10 h-10 animate-bounce" />
                احصل على رقم دور
              </button>
            </div>

        </div>
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

      {/* ======================================================== */}
      {/* MODAL: EDIT / ADD SERVICE NAME FOR KIOSK (MANAGER ACTION) */}
      {/* ======================================================== */}
      {showCategoryEditModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isNewCategory ? 'إضافة خدمة جديدة لجهاز إصدار الدور' : 'تعديل وحفظ اسم الخدمة في جهاز الإصدار'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    تعديل الاسم المعروض للمراجعين لمطابقة أسماء الشبابيك بدقة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCategoryEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4">
              
              {/* Quick Matching from Existing Counters */}
              {counters && counters.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    اقتباس ومطابقة الاسم مباشرة من أحد الشبابيك الحالية:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {counters.map(counter => {
                      // Extract name inside parentheses if any, or full name
                      const match = counter.name.match(/\((.*?)\)/);
                      const cleanName = match ? match[1] : counter.name.replace(/^الشباك\s*\d+\s*/, '');
                      return (
                        <button
                          key={counter.id}
                          type="button"
                          onClick={() => {
                            setFormName(cleanName);
                            if (!formDesc) {
                              setFormDesc(`خدمة تنجز لدى ${counter.name}`);
                            }
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-800 hover:text-amber-900 rounded-lg text-xs font-medium border border-slate-200 transition-colors shadow-xs"
                        >
                          {counter.name} &larr; <strong className="text-amber-700">{cleanName}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Suggested Names from User Brief */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نماذج شائعة بنقرة واحدة:</label>
                <div className="flex flex-wrap gap-1.5">
                  {presetServiceNames.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setFormName(preset.name);
                        setFormDesc(preset.desc);
                      }}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold border border-amber-200 transition-colors"
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Name Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  اسم الخدمة في جهاز الإصدار (المعروض على الشاشة): <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="مثال: توثيق وكالة أو الحصول على صورة عن وكالة"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              {/* Service Description Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  وصف مختصر للخدمة للمراجعين:
                </label>
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={2}
                  placeholder="وصف توضيحي لطبيعة المعاملة والمستندات المطلوبة"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none"
                />
              </div>

              {/* Prefix (Badge letter) & Admin PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    حرف بادئة الترقيم (Prefix):
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formPrefix}
                    onChange={e => setFormPrefix(e.target.value.toUpperCase())}
                    placeholder="A أو B أو C..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    رمز المدير العام للتأكيد:
                  </label>
                  <input
                    type="password"
                    value={formPin}
                    onChange={e => setFormPin(e.target.value)}
                    placeholder="9999"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={savingLoading}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingLoading ? 'جارِ حفظ التعديل...' : 'حفظ التعديل وتحديث شاشة الجهاز فوراً'}
                </button>

                {!isNewCategory && editingCategory && categories.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCategory(editingCategory, e)}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition-colors flex items-center gap-1.5"
                    title="حذف الخدمة بالكامل"
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCategoryEditModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
