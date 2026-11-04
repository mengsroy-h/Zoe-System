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
it.each(['lifecycle', 'duration', 'burst', 'warm', 'deferred', 'capped', 'route', 'mute'])('Java ពិត %s ៖ ពី volume 0 ទៅ max · ស្តារក្រោយ beep/បិទ App · ចុចស្ទួន · អ្នកប្រើប្តូរ volume · OS បដិសេធ · OS ពន្យារ (safe volume) ឬកាត់ការលើក ➜ មិនលើសកម្រិតអ្នកប្រើ · លើកតែពេល media ចេញតាមឧបាល័រទូរស័ព្ទ (កាស · USB · Bluetooth · ឧបករណ៍ជំនួយការស្តាប់ ➜ កម្រិតអ្នកប្រើ) · stream បិទសម្លេង (mute) មិនប៉ះ', async (scenario) => {
    const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
    const { execFileSync } = await import('node:child_process');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-beep-java-'));
    const sources: Record<string, string> = {
        'android/content/Context.java': `package android.content; public class Context { public static final String AUDIO_SERVICE="audio"; public Object getSystemService(String s) { return android.media.AudioManager.instance; } }`,
        'android/media/AudioManager.java': `package android.media; public class AudioManager { public static final int STREAM_MUSIC=3, MODE_NORMAL=0, GET_DEVICES_OUTPUTS=2; public static final AudioManager instance=new AudioManager(); public int volume=0, mode=0, writes=0, safe=-1, cap=15, pending=-1; public int[] outputs={1,2,18,24,25}, route={2}; public boolean fixed=false, refused=false, muted=false, routeThrows=false; public boolean isVolumeFixed(){return fixed;} public int getMode(){return mode;} public boolean isStreamMute(int s){if(s!=3)throw new AssertionError();return muted;} public int getStreamVolume(int s){return muted?0:volume;} public int getStreamMaxVolume(int s){return 15;} public void setStreamVolume(int s,int v,int f){if(refused)throw new SecurityException();writes++;pending=-1;if(v>0)muted=false;if(safe>=0&&v>safe){pending=v;return;}volume=Math.min(v,cap);} public void disableSafeMediaVolume(){safe=-1;if(pending>=0)volume=pending;pending=-1;} public AudioDeviceInfo[] getDevices(int flags){if(flags!=GET_DEVICES_OUTPUTS)throw new AssertionError();AudioDeviceInfo[] out=new AudioDeviceInfo[outputs.length];for(int i=0;i<outputs.length;i++)out[i]=new AudioDeviceInfo(outputs[i]);return out;} public java.util.List<AudioDeviceInfo> getAudioDevicesForAttributes(AudioAttributes a){if(android.os.Build.VERSION.SDK_INT<33)throw new NoSuchMethodError("getAudioDevicesForAttributes");if(a==null||a.legacy!=3)throw new AssertionError();if(routeThrows)throw new IllegalStateException();java.util.List<AudioDeviceInfo> out=new java.util.ArrayList<>();for(int t:route)out.add(new AudioDeviceInfo(t));return out;} }`,
        'android/media/AudioDeviceInfo.java': `package android.media; public class AudioDeviceInfo { public static final int TYPE_BUILTIN_EARPIECE=1, TYPE_BUILTIN_SPEAKER=2, TYPE_WIRED_HEADSET=3, TYPE_WIRED_HEADPHONES=4, TYPE_BLUETOOTH_SCO=7, TYPE_BLUETOOTH_A2DP=8, TYPE_TELEPHONY=18, TYPE_USB_HEADSET=22, TYPE_HEARING_AID=23, TYPE_BUILTIN_SPEAKER_SAFE=24, TYPE_REMOTE_SUBMIX=25, TYPE_BLE_HEADSET=26, TYPE_BLE_SPEAKER=27; private final int type; AudioDeviceInfo(int t){type=t;} public int getType(){return type;} }`,
        'android/media/AudioAttributes.java': `package android.media; public class AudioAttributes { public int legacy=-1; public static class Builder { private int stream=-1; public Builder setLegacyStreamType(int s){stream=s;return this;} public AudioAttributes build(){AudioAttributes a=new AudioAttributes();a.legacy=stream;return a;} } }`,
        'android/os/Build.java': `package android.os; public class Build { public static class VERSION { public static int SDK_INT=36; } public static class VERSION_CODES { public static final int TIRAMISU=33; } }`,
        'android/media/ToneGenerator.java': `package android.media; public class ToneGenerator { public static final int TONE_PROP_BEEP=24,TONE_PROP_PROMPT=27; public static int created=0,released=0,duration=0; public static boolean start=true; public ToneGenerator(int s,int v){if(s!=3||v!=100)throw new AssertionError();created++;} public boolean startTone(int t,int ms){if((t!=24&&t!=27)||ms!=150)throw new AssertionError();duration=Math.min(ms,t==24?40:200);return start;} public void stopTone(){} public void release(){released++;} }`,
        'android/os/Looper.java': `package android.os; public class Looper { public static Looper getMainLooper(){return new Looper();} }`,
        'android/os/Handler.java': `package android.os; public class Handler { public static java.util.List<Runnable> pending=new java.util.ArrayList<>(); public Handler(Looper l){} public boolean post(Runnable r){r.run();return true;} public boolean postDelayed(Runnable r,long ms){if(ms!=200)throw new AssertionError();pending.add(r);return true;} public void removeCallbacks(Runnable r){pending.removeIf(x->x==r);} public static void finish(){for(Runnable r:new java.util.ArrayList<>(pending))r.run();} }`,
        'com/getcapacitor/JSObject.java': `package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object>{}`,
        'com/getcapacitor/Plugin.java': `package com.getcapacitor; public class Plugin { public android.content.Context getContext(){return new android.content.Context();} public void load(){} protected void handleOnResume(){} protected void handleOnPause(){} protected void handleOnDestroy(){} }`,
        'com/getcapacitor/PluginCall.java': `package com.getcapacitor; public class PluginCall { public JSObject result; public void resolve(JSObject o){result=o;} }`,
        'com/getcapacitor/PluginMethod.java': `package com.getcapacitor; public @interface PluginMethod {}`,
        'com/getcapacitor/annotation/CapacitorPlugin.java': `package com.getcapacitor.annotation; public @interface CapacitorPlugin { String name(); }`,
        'com/zoesystem/zoew/Probe.java': `package com.zoesystem.zoew;
import android.media.*; import android.os.Build; import android.os.Handler; import com.getcapacitor.*;
public class Probe {
static void check(boolean b){if(!b)throw new AssertionError();}
static void same(int got,int want){if(got!=want)throw new AssertionError("volume "+got+" != "+want);}
public static void main(String[] args){
AudioManager a=AudioManager.instance; ScanBeepPlugin p=new ScanBeepPlugin(); PluginCall c=new PluginCall();
if(args[0].equals("duration")){p.play(c);check(ToneGenerator.duration==150);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("warm")){p.load();check(ToneGenerator.created==1&&a.writes==0&&Handler.pending.isEmpty());p.play(c);Handler.finish();p.play(c);Handler.finish();check(ToneGenerator.created==1&&ToneGenerator.released==0&&a.volume==0);p.handleOnPause();check(ToneGenerator.released==1);p.handleOnResume();check(ToneGenerator.created==2&&a.volume==0);p.play(c);check(ToneGenerator.created==2);p.handleOnDestroy();check(ToneGenerator.created==ToneGenerator.released);System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("deferred")){a.volume=6;a.safe=10;p.play(c);check(c.result.get("played").equals(true));Handler.finish();same(a.volume,6);a.disableSafeMediaVolume();same(a.volume,6);p.play(c);same(a.volume,15);Handler.finish();same(a.volume,6);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("capped")){a.volume=3;a.cap=10;p.play(c);check(c.result.get("played").equals(true));Handler.finish();same(a.volume,3);p.play(c);a.volume=5;Handler.finish();same(a.volume,5);p.play(c);a.cap=15;a.volume=15;Handler.finish();same(a.volume,15);a.volume=5;p.play(c);same(a.volume,15);Handler.finish();same(a.volume,5);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("route")){int[] outside={0,3,4,5,6,7,8,9,10,11,12,13,14,19,20,21,22,23,26,27,29,30,31,32,33,34,35,99};
for(int sdk:new int[]{24,28,31,32}){Build.VERSION.SDK_INT=sdk;a.route=new int[]{3};
for(int t:outside){a.volume=4;a.writes=0;a.outputs=new int[]{1,2,18,24,25,t};p.play(c);check(c.result.get("played").equals(true));same(a.volume,4);Handler.finish();same(a.volume,4);check(a.writes==0);}
a.outputs=new int[]{1,2,18,24,25};p.play(c);same(a.volume,15);Handler.finish();same(a.volume,4);}
for(int sdk:new int[]{33,36}){Build.VERSION.SDK_INT=sdk;a.outputs=new int[]{1,2,18,24,25,7,8,3};
for(int t:outside){a.route=new int[]{t};a.writes=0;p.play(c);check(c.result.get("played").equals(true));same(a.volume,4);Handler.finish();same(a.volume,4);check(a.writes==0);}
for(int[] r:new int[][]{{},{1},{18},{24},{25},{2,3},{2,8},{8,2},{2,25},{2,24}}){a.route=r;a.writes=0;p.play(c);check(c.result.get("played").equals(true));same(a.volume,4);Handler.finish();same(a.volume,4);check(a.writes==0);}
a.route=new int[]{2};a.routeThrows=true;a.writes=0;p.play(c);check(c.result.get("played").equals(true));same(a.volume,4);Handler.finish();check(a.writes==0);a.routeThrows=false;
a.outputs=new int[]{1,2,18,24,25,7};p.play(c);same(a.volume,15);Handler.finish();same(a.volume,4);}
p.handleOnDestroy();check(ToneGenerator.created==ToneGenerator.released);System.out.print("PASS native volume lifecycle");return;}
if(args[0].equals("mute")){a.volume=8;a.muted=true;p.play(c);check(c.result.get("played").equals(true));Handler.finish();same(a.volume,8);check(a.muted&&a.writes==0);
p.play(c);p.handleOnPause();same(a.volume,8);check(a.muted&&a.writes==0);p.handleOnResume();a.muted=false;p.play(c);same(a.volume,15);Handler.finish();same(a.volume,8);p.handleOnDestroy();System.out.print("PASS native volume lifecycle");return;}
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
}, 40000);
