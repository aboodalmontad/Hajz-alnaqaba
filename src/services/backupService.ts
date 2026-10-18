/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { supabase } from './supabaseClient';

export interface BackupProgress {
  stage: string;
  percent: number;
  recordsCount: number;
  details?: string;
}

/**
 * Helper to fetch all rows from a Supabase table using range pagination
 * to avoid the default 1000-row query limit.
 */
async function fetchAllRows(tableName: string, branchIdFilter?: string): Promise<any[]> {
  const pageSize = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select('*').range(from, from + pageSize - 1);
    if (branchIdFilter) {
      query = query.eq('branch_id', branchIdFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.warn(`Warning: Could not fetch from table "${tableName}":`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

/**
 * Converts JSON array to CSV format safely
 */
function jsonToCSV(items: any[]): string {
  if (!items || items.length === 0) return '';
  const headers = Object.keys(items[0]);
  const rows = items.map(item =>
    headers
      .map(header => {
        const val = item[header];
        if (val === null || val === undefined) return '""';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates and downloads a complete full backup of all branches from Supabase
 */
export async function downloadFullCloudBackup(
  onProgress?: (progress: BackupProgress) => void
): Promise<{ success: boolean; totalRecords: number; fileName: string }> {
  const zip = new JSZip();
  let totalRecords = 0;

  try {
    // 1. Branches
    onProgress?.({ stage: 'جاري جلب بيانات المكاتب والفروع...', percent: 10, recordsCount: 0 });
    const branches = await fetchAllRows('branches');
    totalRecords += branches.length;
    zip.file('data/branches.json', JSON.stringify(branches, null, 2));
    if (branches.length > 0) {
      zip.file('data/csv/branches.csv', jsonToCSV(branches));
    }

    // 2. Branch Managers
    onProgress?.({ stage: 'جاري جلب حسابات مدراء الفروع...', percent: 25, recordsCount: totalRecords });
    const managers = await fetchAllRows('branch_managers');
    totalRecords += managers.length;
    zip.file('data/branch_managers.json', JSON.stringify(managers, null, 2));

    // 3. Agencies Transactions
    onProgress?.({ stage: 'جاري جلب سجلات المعاملات والوكالات التراكمية...', percent: 45, recordsCount: totalRecords });
    const agencies = await fetchAllRows('agencies_transactions');
    totalRecords += agencies.length;
    zip.file('data/agencies_transactions.json', JSON.stringify(agencies, null, 2));
    if (agencies.length > 0) {
      zip.file('data/csv/agencies_transactions.csv', jsonToCSV(agencies));
    }

    // 4. Tickets
    onProgress?.({ stage: 'جاري جلب أرقام الدور وسجلات الطوابير...', percent: 65, recordsCount: totalRecords });
    const tickets = await fetchAllRows('tickets');
    totalRecords += tickets.length;
    zip.file('data/tickets.json', JSON.stringify(tickets, null, 2));
    if (tickets.length > 0) {
      zip.file('data/csv/tickets.csv', jsonToCSV(tickets));
    }

    // 5. Audit Logs
    onProgress?.({ stage: 'جاري جلب سجل العمليات والتدقيق الأمني...', percent: 80, recordsCount: totalRecords });
    const audits = await fetchAllRows('audit_logs');
    totalRecords += audits.length;
    zip.file('data/audit_logs.json', JSON.stringify(audits, null, 2));

    // 6. Counter Sessions
    onProgress?.({ stage: 'جاري جلب جلسات الشبابيك والموظفين...', percent: 90, recordsCount: totalRecords });
    const sessions = await fetchAllRows('counter_sessions');
    totalRecords += sessions.length;
    zip.file('data/counter_sessions.json', JSON.stringify(sessions, null, 2));

    // Manifest metadata
    const manifest = {
      system: 'نظام أرشفة الوكالات وتنظيم الدور – نقابة المحامين بحلب',
      exportType: 'full_cloud_backup',
      exportDate: new Date().toISOString(),
      exportDateArabic: new Date().toLocaleDateString('ar-SY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      totalRecords,
      counts: {
        branches: branches.length,
        managers: managers.length,
        agencies: agencies.length,
        tickets: tickets.length,
        audits: audits.length,
        counterSessions: sessions.length
      },
      branchesList: branches.map(b => ({ id: b.id, name: b.name, code: b.code }))
    };

    zip.file('backup_manifest.json', JSON.stringify(manifest, null, 2));

    // Documentation file
    const readme = `====================================================================
نسخة احتياطية شاملة – نظام أرشفة الوكالات ونظام الدور (نقابة المحامين)
تاريخ التصدير: ${manifest.exportDateArabic}
إجمالي السجلات: ${totalRecords} سجل
====================================================================

محتويات ملف النسخة الاحتياطية:
1. data/branches.json: بيانات الفروع والمكاتب الجغرافية وعناوينها وهواتفها.
2. data/branch_managers.json: حسابات مدراء الفروع وصلاحياتهم.
3. data/agencies_transactions.json: وثائق الوكالات الموثقة وبيانات الموكلين والمحامين والرسوم.
4. data/tickets.json: سجل أرقام الدور وسجلات الخدمة والاستدعاء والانتظار.
5. data/audit_logs.json: سجل التدقيق الأمني والعمليات الإدارية.
6. data/counter_sessions.json: سجل فتح وإغلاق الشبابيك وجلسات الموظفين.
7. data/csv/: نسخ جداول البيانات بصيغة CSV لفتحها في برنامج Excel.
8. backup_manifest.json: ملخص إحصائي شامل وبنية البيانات للتحقق من سلامة النسخة.

ملاحظات الاستعادة:
- هذه البيانات متوافقة مع قاعدة بيانات Supabase المركزية وقواعد البيانات المحلية للمكاتب.
- المفاتيح الأساسية (IDs) ومعرفات الفروع (branch_id) محفوظة بدقة لمنع التكرار والحفاظ على العلاقات.
`;
    zip.file('README.txt', readme);

    // Generate ZIP file
    onProgress?.({ stage: 'جاري ضغط وتجهيز ملف الأرشيف للتنزيل...', percent: 95, recordsCount: totalRecords });
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    // Trigger browser download
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
    const fileName = `نسخة_شاملة_كافة_الفروع_${dateStr}_${timeStr}.zip`;

    const blobUrl = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    onProgress?.({ stage: 'اكتمل التنزيل بنجاح!', percent: 100, recordsCount: totalRecords });
    return { success: true, totalRecords, fileName };
  } catch (err: any) {
    console.error('Backup creation failed:', err);
    throw new Error(err.message || 'فشل إنشاء النسخة الاحتياطية.');
  }
}

/**
 * Generates and downloads a dedicated backup for a SINGLE branch
 */
export async function downloadSingleBranchBackup(
  branchId: string,
  branchName: string,
  onProgress?: (progress: BackupProgress) => void
): Promise<{ success: boolean; totalRecords: number; fileName: string }> {
  const zip = new JSZip();
  let totalRecords = 0;

  try {
    onProgress?.({ stage: `جاري جمع بيانات فرع: ${branchName}...`, percent: 20, recordsCount: 0 });

    // Branch info
    const branchRows = await fetchAllRows('branches');
    const thisBranch = branchRows.filter(b => b.id === branchId);
    zip.file('branch_info.json', JSON.stringify(thisBranch[0] || { id: branchId, name: branchName }, null, 2));

    // Branch agencies
    onProgress?.({ stage: 'جاري جلب معاملات الوكالات التابعة للمكتب...', percent: 40, recordsCount: totalRecords });
    const agencies = await fetchAllRows('agencies_transactions', branchId);
    totalRecords += agencies.length;
    zip.file('agencies_transactions.json', JSON.stringify(agencies, null, 2));
    if (agencies.length > 0) {
      zip.file('agencies_transactions.csv', jsonToCSV(agencies));
    }

    // Branch tickets
    onProgress?.({ stage: 'جاري جلب سجل تذاكر الدور التابعة للمكتب...', percent: 65, recordsCount: totalRecords });
    const tickets = await fetchAllRows('tickets', branchId);
    totalRecords += tickets.length;
    zip.file('tickets.json', JSON.stringify(tickets, null, 2));
    if (tickets.length > 0) {
      zip.file('tickets.csv', jsonToCSV(tickets));
    }

    // Branch audit logs
    onProgress?.({ stage: 'جاري جلب سجلات التدقيق الخاصة بالمكتب...', percent: 85, recordsCount: totalRecords });
    const audits = await fetchAllRows('audit_logs', branchId);
    totalRecords += audits.length;
    zip.file('audit_logs.json', JSON.stringify(audits, null, 2));

    // Manifest
    const manifest = {
      system: 'نظام أرشفة الوكالات وتنظيم الدور – نقابة المحامين بحلب',
      exportType: 'single_branch_backup',
      branchId,
      branchName,
      exportDate: new Date().toISOString(),
      totalRecords,
      counts: {
        agencies: agencies.length,
        tickets: tickets.length,
        audits: audits.length
      }
    };
    zip.file('backup_manifest.json', JSON.stringify(manifest, null, 2));

    // Compress
    onProgress?.({ stage: 'جاري ضغط الملف...', percent: 95, recordsCount: totalRecords });
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeBranchName = branchName.replace(/[\/\\?%*:|"<>]/g, '_');
    const fileName = `نسخة_احتياطية_${safeBranchName}_${dateStr}.zip`;

    const blobUrl = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    onProgress?.({ stage: 'اكتمل التنزيل بنجاح!', percent: 100, recordsCount: totalRecords });
    return { success: true, totalRecords, fileName };
  } catch (err: any) {
    console.error('Single branch backup failed:', err);
    throw new Error(err.message || 'فشل تنزيل نسخة الفرع.');
  }
}
