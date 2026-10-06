export const SELLER_TELEGRAM_HANDLE = 'mengsroyhun';

export function SellerTelegramLink() {
    return (
        <a
            href={'https://t.me/' + SELLER_TELEGRAM_HANDLE}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--primary)", fontWeight: "600" }}
        >
            {'@' + SELLER_TELEGRAM_HANDLE}
        </a>
    );
}
