import { ztoState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';

export interface ZtoListRow { barcode: string; meta: string }
export interface ZtoListGroup { title: string; tone: string; rows: ZtoListRow[]; more: number }
export interface ZtoListPreview { empty: string | null; groups: ZtoListGroup[] }

export function ZtoListSyncBody() {
    useStore(ztoState);
    const view = ztoState.ztoListPreview as ZtoListPreview | null;
    if (!view) return null;
    if (view.empty !== null) return <div className="zto-list-empty">{view.empty}</div>;
    return (
        <>
            {view.groups.map((g) => (
                <div className={`zto-list-group ${g.tone}`} key={g.tone}>
                    <div className="zto-list-group-head">{g.title}</div>
                    {g.rows.length
                        ? g.rows.map((r, i) => (
                            <div className="zto-list-row" key={r.barcode + '|' + i}>
                                <span className="zto-list-code">{r.barcode}</span>
                                <span className="zto-list-meta">{r.meta}</span>
                            </div>
                        ))
                        : <div className="zto-list-row zto-list-row-none">— គ្មាន —</div>}
                    {g.more > 0 ? <div className="zto-list-more">និង {g.more} ទៀត</div> : null}
                </div>
            ))}
        </>
    );
}
