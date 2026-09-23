/** បរិស្ថានតេស្តរបស់ React ៖ បើក `act()` ➜ ការព្រមាន «not configured» បាត់។ */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
