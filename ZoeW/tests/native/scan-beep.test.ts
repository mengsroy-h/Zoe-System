import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ play: vi.fn(), register: vi.fn() }));
vi.mock('@capacitor/core', () => ({ registerPlugin: (name: string) => { h.register(name); return { play: h.play }; } }));
import { playBeep, executeBeepSound } from '../../src/services/history-write';
import { uiState } from '../../src/core/state';
beforeEach(() => { h.play.mockReset().mockResolvedValue({ played: true }); h.register.mockClear(); uiState.globalAudioCtx = null; });
afterEach(() => { delete (window as any).Capacitor; vi.unstubAllGlobals(); uiState.globalAudioCtx = null; });
it('APK ➜ សម្លេងពី native plugin ម្តង គ្មាន WebAudio ស្ទួន', async () => {
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    const Audio = vi.fn(); vi.stubGlobal('AudioContext', Audio);
    playBeep();
    await vi.waitFor(() => expect(h.play).toHaveBeenCalledOnce());
    expect(Audio).not.toHaveBeenCalled();
    expect(h.register).toHaveBeenCalledWith('ZoeScanBeep');
});
it('web ➜ ប្រើ gain ពេញដោយគ្មាន native plugin ហើយកាត់ node ក្រោយសម្លេងចប់', () => {
    const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    const osc: any = { frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    executeBeepSound({ state: 'running', currentTime: 4, destination: {}, createOscillator: () => osc, createGain: () => gain });
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 4.01);
    expect(osc.stop).toHaveBeenCalledWith(4.15);
    osc.onended();
    expect(osc.disconnect).toHaveBeenCalledOnce(); expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(h.play).not.toHaveBeenCalled();
});
it('APK ចាស់គ្មាន plugin ➜ fallback web beep ម្តង ដោយមិនរារាំង scan', async () => {
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    h.play.mockRejectedValue(new Error('not implemented'));
    const stop = vi.fn();
    uiState.globalAudioCtx = { state: 'running', currentTime: 0, destination: {}, createOscillator: () => ({ frequency: {}, connect() {}, start() {}, stop }), createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }) };
    playBeep();
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
it('web ៖ scan ជាប់គ្នាមិនបង្កើតសម្លេងជាន់គ្នា ហើយ callback ចាស់មិនលុបសម្លេងថ្មី', () => {
    const nodes: any[] = [];
    const ctx = { state: 'running', currentTime: 4, destination: {}, createOscillator: vi.fn(() => {
        const osc = { frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null };
        nodes.push(osc); return osc;
    }), createGain: () => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }) };
    executeBeepSound(ctx);
    ctx.currentTime = 4.04;
    executeBeepSound(ctx);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    ctx.currentTime = 4.16;
    executeBeepSound(ctx);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    nodes[0].onended();
    ctx.currentTime = 4.17;
    executeBeepSound(ctx);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    nodes[1].onended();
    expect(nodes.every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
});
it('web ៖ resume កំពុងរង់ចាំប្រើតែមួយ ហើយ cleanup មុន resume ចប់មិនលេងសម្លេងចាស់', async () => {
    let resolve!: () => void;
    const old = { state: 'suspended', resume: vi.fn(() => new Promise<void>((r) => { resolve = r; })) };
    const create = vi.fn();
    uiState.globalAudioCtx = old;
    playBeep(); playBeep();
    expect(old.resume).toHaveBeenCalledTimes(1);
    uiState.globalAudioCtx = { state: 'running', currentTime: 0, createOscillator: create };
    resolve();
    await Promise.resolve(); await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
});
it.each(['lifecycle', 'duration', 'burst', 'warm'])('Java ពិត %s ៖ ពី volume 0 ទៅ max · ស្តារក្រោយ beep/បិទ App · ចុចស្ទួន · អ្នកប្រើប្តូរ volume · OS បដិសេធ', async (scenario) => {
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    const { execFileSync } = await import('node:child_process');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-beep-java-'));
    const sources: Record<string, string> = {
        'android/content/Context.java': `package android.content; public class Context { public static final String AUDIO_SERVICE="audio"; public Object getSystemService(String s) { return android.media.AudioManager.instance; } }`,
        'android/media/AudioManager.java': `package android.media; public class AudioManager { public static final int STREAM_MUSIC=3, MODE_NORMAL=0; public static final AudioManager instance=new AudioManager(); public int volume=0, mode=0, writes=0; public boolean fixed=false, refused=false; public boolean isVolumeFixed(){return fixed;} public int getMode(){return mode;} public int getStreamVolume(int s){return volume;} public int getStreamMaxVolume(int s){return 15;} public void setStreamVolume(int s,int v,int f){if(refused)throw new SecurityException();volume=v;writes++;} }`,
        'android/media/ToneGenerator.java': `package android.media; public class ToneGenerator { public static final int TONE_PROP_BEEP=24,TONE_PROP_PROMPT=27; public static int created=0,released=0,duration=0; public static boolean start=true; public ToneGenerator(int s,int v){if(s!=3||v!=100)throw new AssertionError();created++;} public boolean startTone(int t,int ms){if((t!=24&&t!=27)||ms!=150)throw new AssertionError();duration=Math.min(ms,t==24?40:200);return start;} public void stopTone(){} public void release(){released++;} }`,
        'android/os/Looper.java': `package android.os; public class Looper { public static Looper getMainLooper(){return new Looper();} }`,
        'android/os/Handler.java': `package android.os; public class Handler { public static java.util.List<Runnable> pending=new java.util.ArrayList<>(); public Handler(Looper l){} public boolean post(Runnable r){r.run();return true;} public boolean postDelayed(Runnable r,long ms){if(ms!=200)throw new AssertionError();pending.add(r);return true;} public void removeCallbacks(Runnable r){pending.removeIf(x->x==r);} public static void finish(){for(Runnable r:new java.util.ArrayList<>(pending))r.run();} }`,
        'com/getcapacitor/JSObject.java': `package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object>{}`,
        'com/getcapacitor/Plugin.java': `package com.getcapacitor; public class Plugin { public android.content.Context getContext(){return new android.content.Context();} public void load(){} protected void handleOnResume(){} protected void handleOnPause(){} protected void handleOnDestroy(){} }`,
        'com/getcapacitor/PluginCall.java': `package com.getcapacitor; public class PluginCall { public JSObject result; public void resolve(JSObject o){result=o;} }`,
        'com/getcapacitor/PluginMethod.java': `package com.getcapacitor; public @interface PluginMethod {}`,
        'com/getcapacitor/annotation/CapacitorPlugin.java': `package com.getcapacitor.annotation; public @interface CapacitorPlugin { String name(); }`,
        'com/zoesystem/zoew/Probe.java': `package com.zoesystem.zoew;
import android.media.*; import android.os.Handler; import com.getcapacitor.*;
public class Probe {
static void check(boolean b){if(!b)throw new AssertionError();}
public static void main(String[] args){
AudioManager a=AudioManager.instance; ScanBeepPlugin p=new ScanBeepPlugin(); PluginCall c=new PluginCall();
if(args[0].equals("duration")){p.play(c);check(ToneGenerator.duration==150);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("warm")){p.load();check(ToneGenerator.created==1&&a.writes==0&&Handler.pending.isEmpty());p.play(c);Handler.finish();p.play(c);Handler.finish();check(ToneGenerator.created==1&&ToneGenerator.released==0&&a.volume==0);p.handleOnPause();check(ToneGenerator.released==1);p.handleOnResume();check(ToneGenerator.created==2&&a.volume==0);p.play(c);check(ToneGenerator.created==2);p.handleOnDestroy();check(ToneGenerator.created==ToneGenerator.released);System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("burst")){a.volume=3;p.play(c);int created=ToneGenerator.created,writes=a.writes;p.play(c);p.play(c);check(ToneGenerator.created==created&&ToneGenerator.released==0&&a.writes==writes&&c.result.get("played").equals(true));Handler.finish();check(a.volume==3);p.play(c);check(ToneGenerator.created==created);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
p.play(c);check(a.volume==15&&c.result.get("played").equals(true));Handler.finish();check(a.volume==0);
a.volume=3;p.play(c);p.play(c);check(a.volume==15&&Handler.pending.size()==1);Handler.finish();check(a.volume==3);
p.play(c);a.volume=7;Handler.finish();check(a.volume==7);
p.play(c);p.handleOnPause();check(a.volume==7&&Handler.pending.isEmpty()&&ToneGenerator.created==ToneGenerator.released);
int created=ToneGenerator.created;p.play(c);check(ToneGenerator.created==created&&a.volume==7);p.handleOnResume();
p.play(c);p.handleOnDestroy();check(a.volume==7&&Handler.pending.isEmpty()&&ToneGenerator.created==ToneGenerator.released);
created=ToneGenerator.created;p.handleOnResume();p.play(c);check(ToneGenerator.created==created&&a.volume==7);p=new ScanBeepPlugin();
a.fixed=true;a.writes=0;p.play(c);Handler.finish();check(a.volume==7&&a.writes==0);a.fixed=false;
a.mode=2;p.play(c);Handler.finish();check(a.volume==7&&a.writes==0);a.mode=0;
a.refused=true;p.play(c);check(c.result.get("played").equals(false)&&Handler.pending.isEmpty());a.refused=false;
ToneGenerator.start=false;p.play(c);check(a.volume==7&&c.result.get("played").equals(false)&&Handler.pending.isEmpty());
p.handleOnDestroy();
check(ToneGenerator.created==ToneGenerator.released);System.out.print("PASS native volume lifecycle");
}}
`
    };
    try {
        for (const [file, source] of Object.entries(sources)) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, source); }
        const plugin = path.resolve(__dirname, '../../android/app/src/main/java/com/zoesystem/zoew/ScanBeepPlugin.java');
        execFileSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '-d', root, plugin, ...Object.keys(sources).map((p) => path.join(root, p))], { timeout: 20000 });
        expect(execFileSync('java', ['-cp', root, 'com.zoesystem.zoew.Probe', scenario], { timeout: 10000, encoding: 'utf8' })).toBe('PASS native volume lifecycle');
        const main = fs.readFileSync(path.resolve(plugin, '../MainActivity.java'), 'utf8');
        const manifest = fs.readFileSync(path.resolve(plugin, '../../../../../AndroidManifest.xml'), 'utf8');
        expect(main.indexOf('registerPlugin(ScanBeepPlugin.class);')).toBeGreaterThan(-1);
        expect(main.indexOf('registerPlugin(ScanBeepPlugin.class);')).toBeLessThan(main.indexOf('super.onCreate(savedInstanceState);'));
        expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
