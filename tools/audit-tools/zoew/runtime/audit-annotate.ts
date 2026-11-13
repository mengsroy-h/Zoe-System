const EVENT_PROPS: Array<[string, string]> = [['onClick', 'click'], ['onChange', 'change'], ['onInput', 'input'], ['onSubmit', 'submit']];

export function annotateActions(root: Element): number {
    let count = 0;
    const all = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const el of all) {
        const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
        if (!key) continue;
        const props = (el as any)[key];
        if (!props) continue;
        for (const [prop, eventName] of EVENT_PROPS) {
            const handler = props[prop];
            if (!handler || typeof handler.actionName !== 'string') continue;
            const options = handler.actionOptions || {};
            el.setAttribute('data-act', handler.actionName);
            if (eventName !== 'click') el.setAttribute('data-on', eventName);
            if (options.args && options.args.length) el.setAttribute('data-args', JSON.stringify(options.args));
            if (options.evt) el.setAttribute('data-evt', '1');
            if (options.self) el.setAttribute('data-self', '1');
            count++;
            break;
        }
    }
    return count;
}
