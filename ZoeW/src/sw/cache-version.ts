/**
 * កំណែ cache របស់ Service Worker។
 *
 * ⛔ វា **មិនមែន** `APP_VERSION` ទេ (ច្បាប់ ៦ របស់គម្រោង) ៖ `APP_VERSION`
 *    ប្រាប់អ្នកប្រើថា App ជំនាន់ណា ចំណែកកូនសោនេះបញ្ជាឲ្យ browser
 *    **បោះសំបកចាស់ចោល**។ ត្រូវឡើងរាល់ពេលធនធានសំបកណាមួយប្រែ។
 */
// ⛔ បន្តលំដាប់ `zoew-vN` របស់ ZoeW ដើម (`zoew-v222`) ៖ App ជំនួស ZoeW លើ origin ដដែល
//    ➜ SW ថ្មីត្រូវលុប cache ចាស់ (តម្រង `zoew-` ក្នុង `sw.ts`)។
export const CACHE_VERSION = 'zoew-v225';
