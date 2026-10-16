-- ============================================================================
-- نقابة المحامين - المنظومة المركزية لإدارة الدور وتنظيم الوكالات والرقابة
-- قاعدة البيانات المركزية الموحدة (Supabase / PostgreSQL)
-- إصدار السكربت: 1.0.0
-- متوافق تماماً مع النظام المحلي لجميع الفروع والمقر الرئيسي
-- ============================================================================

-- 1. تفعيل الإضافات البرمجية لتوليد المعرفات الفريدة ودعم التشفير
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. جدول الفروع والمكاتب (Branches & Headquarters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.branches (
    id VARCHAR(50) PRIMARY KEY,                     -- معرّف المكتب مثل 'branch-aleppo-main'
    name VARCHAR(150) NOT NULL,                    -- اسم الفرع (مثلاً: فرع القصر العدلي - حلب)
    code VARCHAR(20) UNIQUE NOT NULL,              -- كود مختصر مثل 'ALP-MAIN', 'AFR', 'AZZ'
    city VARCHAR(100) DEFAULT 'حلب',               -- المدينة أو المنطقة
    address TEXT,                                  -- العنوان التفصيلي للمكتب
    phone VARCHAR(50),                             -- هاتف التواصل
    is_headquarters BOOLEAN DEFAULT FALSE,         -- هل هذا هو المقر الرئيسي للنقابة؟
    is_active BOOLEAN DEFAULT TRUE,                -- حالة المكتب (نشط / معلق)
    sync_api_key TEXT DEFAULT encode(gen_random_bytes(24), 'hex'), -- مفتاح مصادقة المزامنة السحابية الخاص بالفرع
    last_sync_at TIMESTAMPTZ,                      -- تاريخ وتوقيت آخر مزامنة ناجحة من هذا الفرع
    last_known_ip VARCHAR(50),                     -- عنوان IP الخادم المحلي للفرع عند آخر اتصال
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. جدول فئات الخدمات والمعاملات (Services & Categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.services_categories (
    id VARCHAR(50) NOT NULL,                       -- معرف الخدمة مثل 'general', 'special'
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    prefix VARCHAR(5) NOT NULL,                    -- بادئة التذكرة (A, B, C...)
    name VARCHAR(150) NOT NULL,                    -- اسم الخدمة (مثلاً: توثيق وكالة)
    description TEXT DEFAULT '',                   -- الوصف والشروط المطلوبة للمعاملة
    is_active BOOLEAN DEFAULT TRUE,                -- هل الخدمة مفعلة؟
    assigned_counter_id VARCHAR(50),               -- الشباك المخصص افتراضياً للخدمة
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (branch_id, id)                    -- مفتاح أساسي مركب لضمان خصوصية إعدادات كل فرع
);

-- ============================================================================
-- 4. جدول الموظفين والمستخدمين والمندوبين (Staff & Users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_users (
    id VARCHAR(50) NOT NULL,                       -- المعرف المحلي للموظف في الفرع
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,                    -- اسم الموظف أو المندوب
    pin VARCHAR(20) NOT NULL,                      -- الرمز الشخصي للدخول
    role VARCHAR(30) DEFAULT 'staff',              -- الدور: 'staff' (مندوب) أو 'admin' (مدير فرع / مدير عام)
    job_title VARCHAR(100) DEFAULT 'مندوب وكالات', -- المسمى الوظيفي (مندوب رئيس الفرع، موظف توثيق، إلخ)
    is_active BOOLEAN DEFAULT TRUE,                -- هل الحساب مفعّل؟
    allowed_counters JSONB DEFAULT '[]'::jsonb,    -- مصفوفة الشبابيك المسموح له العمل عليها
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (branch_id, id)
);

-- ============================================================================
-- 5. جدول الشبابيك ونقاط الخدمة (Counters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.counters (
    id VARCHAR(50) NOT NULL,                       -- المعرف المحلي للشباك
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                    -- اسم الشباك (الشباك 1، شباك التوثيق 2...)
    is_open BOOLEAN DEFAULT TRUE,                  -- هل الشباك مفتوح في الصالة؟
    is_paused BOOLEAN DEFAULT FALSE,               -- هل الشباك في فترة استراحة مؤقتة؟
    assigned_service_id VARCHAR(50),               -- الخدمة المقيدة بالشباك إن وجدت
    current_staff_id VARCHAR(50),                  -- الموظف الشاغل للشباك حالياً
    claimed_at TIMESTAMPTZ,                        -- وقت حجز الشباك من قبل الموظف
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (branch_id, id)
);

-- ============================================================================
-- 6. جدول مناوبات وجلسات عمل الموظفين على الشبابيك (Counter Sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.counter_sessions (
    id VARCHAR(100) NOT NULL,                      -- معرف الجلسة المحلي (cs-...)
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    staff_id VARCHAR(50) NOT NULL,                 -- معرف الموظف
    staff_name VARCHAR(150) NOT NULL,              -- اسم الموظف وقت المناوبة
    counter_id VARCHAR(50) NOT NULL,               -- معرّف الشباك
    counter_name VARCHAR(100) NOT NULL,            -- اسم الشباك وقت المناوبة
    started_at TIMESTAMPTZ NOT NULL,               -- وقت بدء العمل
    ended_at TIMESTAMPTZ,                          -- وقت إنهاء العمل ومغادرة الشباك
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (branch_id, id)
);

-- ============================================================================
-- 7. جدول التذاكر وعمليات الدور (Tickets & Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
    cloud_id UUID DEFAULT gen_random_uuid() UNIQUE,-- معرّف فريد عالمي للتذكرة على مستوى السحابة
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    local_id VARCHAR(100) NOT NULL,                -- معرّف التذكرة المحلي في الفرع (ticket-...)
    ticket_date DATE NOT NULL,                     -- تاريخ يوم العمل للتذكرة (YYYY-MM-DD)
    ticket_number INTEGER NOT NULL,                -- الرقم التسلسلي اليومي (1, 2, 3...)
    display_number VARCHAR(20) NOT NULL,           -- رقم العرض في الشاشة (مثل A-001, B-024)
    category_id VARCHAR(50) NOT NULL,              -- معرّف فئة الخدمة
    category_name_arabic VARCHAR(150) NOT NULL,    -- اسم الخدمة باللغة العربية
    status VARCHAR(30) NOT NULL DEFAULT 'waiting', -- الحالة: waiting | serving | completed | skipped | cancelled
    counter_id VARCHAR(50),                        -- الشباك الذي استدعى التذكرة
    counter_name VARCHAR(100),                     -- اسم الشباك وقت الاستدعاء
    staff_id VARCHAR(50),                          -- الموظف الذي خدم المراجع
    staff_name VARCHAR(150),                       -- اسم الموظف
    recall_count INTEGER DEFAULT 0,                -- عدد مرات إعادة النداء (الحد الأقصى 3)
    created_at TIMESTAMPTZ NOT NULL,               -- توقيت سحب التذكرة من الكشك
    called_at TIMESTAMPTZ,                         -- توقيت النداء الأول على الشاشة
    documenting_started_at TIMESTAMPTZ,            -- توقيت بدء مندوب النقابة بتوثيق الوكالة
    completed_at TIMESTAMPTZ,                      -- توقيت إنجاز المعاملة وتسليمها
    notes TEXT,                                    -- ملاحظات التذكرة أو أسباب التجاوز
    synced_at TIMESTAMPTZ DEFAULT NOW(),           -- توقيت وصول السجل إلى قاعدة البيانات السحابية
    PRIMARY KEY (branch_id, local_id)              -- مركب لحماية التذاكر من التضارب بين الفروع
);

-- ============================================================================
-- 8. جدول المعاملات والوكالات المفصلة (Agencies & Legal Transactions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agencies_transactions (
    cloud_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    ticket_cloud_id UUID REFERENCES public.tickets(cloud_id) ON DELETE SET NULL,
    local_ticket_id VARCHAR(100),                  -- معرّف التذكرة المقترنة في الفرع
    agency_number VARCHAR(100),                    -- رقم الوكالة في السجل العام لنقابة المحامين
    agency_year INTEGER,                           -- سنة تنظيم الوكالة
    agency_type VARCHAR(100) NOT NULL,             -- عامة، خاصة، تصديق، عزل، صورة طبق الأصل
    principals_names TEXT,                         -- أسماء الموكلين (أطراف الوكالة)
    lawyers_names TEXT,                            -- أسماء المحامين الوكلاء
    national_id_or_passport VARCHAR(50),           -- الرقم الوطني للمراجع / الموكل الرئيسي
    fees_paid NUMERIC(12, 2) DEFAULT 0.00,         -- الرسوم والنقود المستوفاة
    receipt_number VARCHAR(100),                   -- رقم إيصال الصندوق
    notary_delegate_name VARCHAR(150),             -- مندوب رئيس الفرع الموثق
    is_revoked BOOLEAN DEFAULT FALSE,              -- هل تم عزل هذه الوكالة لاحقاً؟
    revocation_date DATE,                          -- تاريخ العزل إن وجد
    status VARCHAR(50) DEFAULT 'approved',         -- حالة المعاملة: approved | pending_review | rejected
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. جدول المرفقات والوثائق وصور الوكالات (Transaction Attachments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transaction_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.agencies_transactions(cloud_id) ON DELETE CASCADE,
    local_ticket_id VARCHAR(100),
    file_name VARCHAR(255) NOT NULL,               -- اسم الملف الأصلي (مثلاً: agency_page_1.jpg)
    file_type VARCHAR(100) NOT NULL,               -- نوع الملف MIME (image/jpeg, application/pdf)
    file_size_bytes BIGINT,                        -- حجم الملف بالبايت
    file_hash_sha256 VARCHAR(64) NOT NULL,         -- بصمة الهاش الرقمي للتحقق من عدم تلف الملف أثناء النقل
    storage_path TEXT NOT NULL,                    -- مسار الملف داخل Supabase Storage أو القرص المحلي
    is_uploaded_to_cloud BOOLEAN DEFAULT FALSE,    -- هل تم رفع الملف الفعلي للسحابة بنجاح؟
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. جدول سجل الرقابة والعمليات المركزية (Audit Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    cloud_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    local_id VARCHAR(100),                         -- معرف السجل في الفرع (log-...)
    timestamp TIMESTAMPTZ NOT NULL,                -- تاريخ ووقت الحدث بدقة أجزاء الثانية
    action VARCHAR(150) NOT NULL,                  -- الإجراء (استدعاء مراجع، عزل وكالة، بدء يوم جديد...)
    details TEXT NOT NULL,                         -- التفاصيل الدقيقة للعملية
    operator_user VARCHAR(150) NOT NULL,           -- اسم الموظف أو المدير المنفذ
    category VARCHAR(50) DEFAULT 'ticket',         -- تصنيف الإجراء (ticket, counter, staff, settings, auth, system)
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. جدول طابور المزامنة وحالة الإرسال والاستقبال (Sync Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id BIGSERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,              -- اسم الكيان: 'ticket', 'counter_session', 'audit_log', 'agency'
    entity_local_id VARCHAR(100) NOT NULL,         -- معرف السجل الأصلي في الفرع
    operation VARCHAR(20) NOT NULL,                -- نوع العملية: 'INSERT', 'UPDATE', 'DELETE'
    payload JSONB NOT NULL,                        -- حمولة البيانات بتنسيق JSONB
    sync_status VARCHAR(20) DEFAULT 'pending',     -- 'pending' (قيد الانتظار) | 'synced' (تم الرفع) | 'failed' (فشل)
    retry_count INTEGER DEFAULT 0,                 -- عدد محاولات إعادة الإرسال
    error_message TEXT,                            -- رسالة الخطأ في حال الفشل
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- ============================================================================
-- 12. جدول تاريخ عمليات المزامنة المركزية (Sync History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sync_history (
    id BIGSERIAL PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    sync_direction VARCHAR(20) DEFAULT 'branch_to_cloud', -- 'branch_to_cloud' أو 'cloud_to_hq'
    records_pushed INTEGER DEFAULT 0,              -- عدد السجلات التي رفعت بنجاح
    files_uploaded INTEGER DEFAULT 0,              -- عدد المرفقات والوثائق التي رفعت
    status VARCHAR(30) DEFAULT 'success',          -- 'success' | 'partial' | 'failed'
    details TEXT,                                  -- ملخص العملية
    ip_address VARCHAR(50),                        -- عنوان IP المتصل
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 13. جدول سجلات النسخ الاحتياطي للفروع والمقر (Backup Records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.backup_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    backup_type VARCHAR(50) DEFAULT 'json_snapshot',-- 'json_snapshot' | 'sql_dump' | 'cloud_mirror'
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    records_count INTEGER,
    status VARCHAR(30) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 14. إنشاء الفهارس (Indexes) لضمان السرعة الفائقة في البحث والتقارير
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_branch_date ON public.tickets(branch_id, ticket_date);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_display ON public.tickets(display_number);

CREATE INDEX IF NOT EXISTS idx_audit_branch_time ON public.audit_logs(branch_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON public.audit_logs(category);

CREATE INDEX IF NOT EXISTS idx_agencies_number ON public.agencies_transactions(agency_number);
CREATE INDEX IF NOT EXISTS idx_agencies_branch ON public.agencies_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_agencies_created ON public.agencies_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON public.sync_queue(branch_id, sync_status, retry_count);
CREATE INDEX IF NOT EXISTS idx_sessions_branch_staff ON public.counter_sessions(branch_id, staff_id);

-- ============================================================================
-- 15. دوال وتريجرات التحديث التلقائي للوقت (Automatic Updated At Trigger)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON public.branches;
CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services_categories;
CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON public.services_categories
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated_at ON public.staff_users;
CREATE TRIGGER trg_staff_updated_at
BEFORE UPDATE ON public.staff_users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_counters_updated_at ON public.counters;
CREATE TRIGGER trg_counters_updated_at
BEFORE UPDATE ON public.counters
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_agencies_updated_at ON public.agencies_transactions;
CREATE TRIGGER trg_agencies_updated_at
BEFORE UPDATE ON public.agencies_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 16. إعداد سياسات أمان الجداول (Row Level Security - RLS)
-- ============================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_records ENABLE ROW LEVEL SECURITY;

-- سياسات تتيح لمفتاح الخدمة (Service Role / Backend Server) الوصول الكامل لقراءة وكتابة البيانات
CREATE POLICY "Full access for service role" ON public.branches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.services_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.staff_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.counters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.counter_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.agencies_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.transaction_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.sync_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.sync_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access for service role" ON public.backup_records FOR ALL TO service_role USING (true) WITH CHECK (true);

-- سياسة قراءة عامة للبيانات المصرح بها للمصادق عليهم
CREATE POLICY "Allow authenticated read branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read tickets" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read audits" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read agencies" ON public.agencies_transactions FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 17. تغذية البيانات الأولية للمشروع (Seed Data)
-- ============================================================================

-- 1. الفروع الخمسة الافتراضية لنقابة المحامين بحلب
INSERT INTO public.branches (id, name, code, city, address, is_headquarters) VALUES
('branch-aleppo-main', 'المقر الرئيسي - القصر العدلي بحلب', 'ALP-MAIN', 'حلب', 'القصر العدلي - دائرة تنظيم الوكالات', true),
('branch-afrin', 'مكتب نقابة المحامين - فرع عفرين', 'ALP-AFR', 'عفرين', 'مبنى المجمع القضائي - عفرين', false),
('branch-azaz', 'مكتب نقابة المحامين - فرع إعزاز', 'ALP-AZZ', 'إعزاز', 'شارع المحكمة - دار نقابة المحامين', false),
('branch-albab', 'مكتب نقابة المحامين - فرع الباب', 'ALP-BAB', 'مدينة الباب', 'جانب قصر العدل بالباب', false),
('branch-manbij', 'مكتب نقابة المحامين - فرع منبج / الأتارب', 'ALP-MNB', 'ريف حلب', 'مكتب النقابة المعتمد', false)
ON CONFLICT (id) DO NOTHING;

-- 2. الخدمات الأساسية المطابقة للنظام القائم حالياً للفرع الرئيسي
INSERT INTO public.services_categories (id, branch_id, prefix, name, description, is_active) VALUES
('special', 'branch-aleppo-main', 'A', 'توثيق وكالة', 'تنجز هذه المعاملة أمام مندوب رئيس الفرع للتثبت من الهوية ومحتويات الوكالة أصولاً', true),
('cat_copies', 'branch-aleppo-main', 'B', 'الحصول على صورة عن وكالة', 'سحب واستخراج صورة مصدقة طبق الأصل عن وكالة محفوظة في الأرشيف', true),
('cat_revocation', 'branch-aleppo-main', 'C', 'عزل وكالة', 'لعزل وكالة محامي يتطلب وجود صورة أو رقم الوكالة ودفع رسم العزل وتبليغ المحامي المعزول', true),
('cat_contracts', 'branch-aleppo-main', 'D', 'تصديق العقود والاتفاقيات', 'تصديق العقود والاتفاقيات بحضور أطراف العقد لدى مندوب الفرع', true),
('cat_inquiry', 'branch-aleppo-main', 'E', 'الاستعلامات والدعم', 'الاستفسار عن قيود الوكالات والرسوم والإجراءات الإدارية', true)
ON CONFLICT (branch_id, id) DO NOTHING;

-- 3. الشبابيك الافتراضية المطابقة للنظام الحالي
INSERT INTO public.counters (id, branch_id, name, is_open, is_paused) VALUES
('counter-1', 'branch-aleppo-main', 'الشباك 1', true, false),
('counter-2', 'branch-aleppo-main', 'الشباك 2', true, false),
('counter-3', 'branch-aleppo-main', 'الشباك 3', true, false),
('counter-4', 'branch-aleppo-main', 'الشباك 4', true, false),
('counter-5', 'branch-aleppo-main', 'الشباك 5', true, false)
ON CONFLICT (branch_id, id) DO NOTHING;

-- 4. كادر الموظفين الافتراضي المطابق للنظام الحالي
INSERT INTO public.staff_users (id, branch_id, name, pin, role, job_title, is_active) VALUES
('staff-1791572701221', 'branch-aleppo-main', 'حسان مرشحة', '123456', 'staff', 'مندوب رئيس الفرع', true),
('staff-1791572724537', 'branch-aleppo-main', 'زكريا ننه', '123456', 'staff', 'مندوب وكالات', true),
('staff-1791657691085', 'branch-aleppo-main', 'محمود ويس', '123456', 'staff', 'موظف شباك وتوثيق', true)
ON CONFLICT (branch_id, id) DO NOTHING;
