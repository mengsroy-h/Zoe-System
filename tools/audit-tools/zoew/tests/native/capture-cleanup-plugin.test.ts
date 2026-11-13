import { expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const JAVA_DIR = path.resolve(__dirname, '../../../../../ZoeW/android/app/src/main/java/com/zoesystem/zoew');

const stubs: Record<string, string> = {
    'android/content/Context.java': `package android.content; public class Context {
public static java.io.File pictures, cache; public static boolean broken=false;
public java.io.File getCacheDir(){if(broken)throw new IllegalStateException();return cache;}
public java.io.File getExternalFilesDir(String type){if(broken)throw new IllegalStateException();if(!"Pictures".equals(type))throw new AssertionError(type);return pictures;} }`,
    'android/os/Environment.java': `package android.os; public class Environment { public static final String DIRECTORY_PICTURES="Pictures"; }`,
    'com/getcapacitor/JSObject.java': `package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object>{}`,
    'com/getcapacitor/Plugin.java': `package com.getcapacitor; public class Plugin { public android.content.Context getContext(){return new android.content.Context();} public void load(){} }`,
    'com/getcapacitor/PluginCall.java': `package com.getcapacitor; public class PluginCall { public java.util.Map<String,Object> data=new java.util.HashMap<>(); public JSObject result;
public String getString(String n,String d){Object v=data.get(n);return v instanceof String?(String)v:d;}
public Long getLong(String n,Long d){Object v=data.get(n);return v instanceof Long?(Long)v:d;}
public void resolve(JSObject o){result=o;} }`,
    'com/getcapacitor/PluginMethod.java': `package com.getcapacitor; public @interface PluginMethod {}`,
    'com/getcapacitor/annotation/CapacitorPlugin.java': `package com.getcapacitor.annotation; public @interface CapacitorPlugin { String name(); }`,
    'com/zoesystem/zoew/Probe.java': `package com.zoesystem.zoew;
import android.content.Context; import com.getcapacitor.*; import java.io.File; import java.nio.file.*;
public class Probe {
static long NOW=System.currentTimeMillis();
static void check(boolean b,String what){if(!b)throw new AssertionError(what);}
static File file(File dir,String name,int bytes,long modified)throws Exception{dir.mkdirs();File f=new File(dir,name);Files.write(f.toPath(),new byte[bytes]);if(modified>0)check(f.setLastModified(modified),"mtime "+name);return f;}
static void joinWorker()throws Exception{for(Thread t:Thread.getAllStackTraces().keySet())if("ZoeCaptureCleanup".equals(t.getName()))t.join(10000);}
static PluginCall call(Object name,Object before){PluginCall c=new PluginCall();if(name!=null)c.data.put("name",name);if(before!=null)c.data.put("before",before);return c;}
public static void main(String[] args)throws Exception{
File root=new File(args[1]);File pictures=new File(root,"ext/Pictures");File cache=new File(root,"cache");File dcim=new File(root,"DCIM");
Context.pictures=pictures;Context.cache=cache;
String shot="JPEG_20261103_101010_8211938443127743161.jpg";
if(args[0].equals("release")){
File read=file(pictures,shot,4096,NOW-60000);File outside=file(dcim,shot,4096,NOW-60000);
File oldEmpty=file(pictures,"JPEG_20261103_100000_1.jpg",0,NOW-60000);File oldFull=file(pictures,"JPEG_20261103_100001_2.jpg",4096,NOW-60000);
File fresh=file(pictures,"JPEG_20261103_101011_3.jpg",0,NOW-500);File pending=file(pictures,"JPEG_20261103_101012_4.jpg",0,NOW+1000);
File img=file(pictures,"IMG_20261103_101010.jpg",4096,NOW-60000);File png=file(pictures,"JPEG_20261103_100002_5.png",4096,NOW-60000);File txt=file(pictures,"notes.txt",4,NOW-60000);
File dir=new File(pictures,"JPEG_20261103_100003_6.jpg");dir.mkdirs();dir.setLastModified(NOW-60000);
CaptureCleanupPlugin p=new CaptureCleanupPlugin();
PluginCall c=call("../../DCIM/"+shot,null);check(new File(pictures,"../../DCIM/"+shot).getCanonicalFile().equals(outside.getCanonicalFile()),"traversal target");p.release(c);check(outside.exists()&&read.exists()&&c.result.get("removed").equals(0),"traversal");
c=call("IMG_20261103_101010.jpg",null);p.release(c);check(img.exists()&&c.result.get("removed").equals(0),"not a capture name");
c=call(shot,0);p.release(c);check(!read.exists()&&outside.exists()&&oldEmpty.exists()&&oldFull.exists()&&c.result.get("removed").equals(1),"exact name only");
c=call(shot,0);p.release(c);check(c.result.get("removed").equals(0),"repeat");
c=call("",NOW);p.release(c);
check(!oldEmpty.exists()&&!oldFull.exists(),"old captures swept");
check(fresh.exists()&&pending.exists(),"captures newer than before - slack kept");
check(img.exists()&&png.exists()&&txt.exists()&&dir.isDirectory()&&outside.exists(),"non-captures kept");
check(c.result.get("removed").equals(2),"count "+c.result.get("removed"));
check(CaptureCleanupPlugin.isCapture("JPEG_\\u17e2\\u17e0\\u17e2\\u17e6\\u17e1\\u17e1\\u17e0\\u17e3_\\u17e1\\u17e0\\u17e1\\u17e0\\u17e1\\u17e0_7.jpg")&&!CaptureCleanupPlugin.isCapture("JPEG_20261103_101010_7.jpg/x")&&!CaptureCleanupPlugin.isCapture("JPEG_.jpg")&&!CaptureCleanupPlugin.isCapture(null),"capture names in any digit script only");
c=call(null,null);p.release(c);check(fresh.exists()&&pending.exists()&&c.result.get("removed").equals(0),"no args");
c=call(42,"x");p.release(c);check(c.result.get("removed").equals(0),"bad types");
Context.pictures=null;c=call(shot,NOW);p.release(c);check(c.result.get("removed").equals(0),"no external storage");
Context.pictures=pictures;Context.broken=true;c=call(shot,NOW);p.release(c);check(c.result!=null&&c.result.get("removed").equals(0),"fail open");
System.out.print("PASS capture cleanup");return;}
if(args[0].equals("load")){
long day=24L*60*60*1000;String hash="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";String hash2=hash.replace('0','f');String hash3=hash.replace('1','e');
File queue=new File(cache,"queue-photo");
File oldShared=file(new File(queue,hash),"zoew-sign-77130500000012.jpg",4096,NOW-day-60000);
File recentShared=file(new File(queue,hash2),"zoew-sign-77130500000013.jpg",4096,NOW-3600000);
File oldOther=file(new File(queue,hash3),"note.txt",4,NOW-day-60000);
File oldShared3=file(new File(queue,hash3),"zoew-sign-77130500000014.jpg",4096,NOW-day-60000);
File notHash=file(new File(queue,"abc"),"zoew-sign-1.jpg",4096,NOW-day-60000);
File loose=file(queue,"zoew-sign-2.jpg",4096,NOW-day-60000);
File apk=file(new File(cache,"apk-update"),"ZoeW-2.50.180.apk",4096,NOW-day-60000);
File outsideTarget=file(dcim,"zoew-sign-3.jpg",4096,NOW-day-60000);
String hash4=hash.replace('2','d');Files.createSymbolicLink(new File(queue,hash4).toPath(),dcim.toPath());
File oldCapture=file(pictures,"JPEG_20261102_090000_11.jpg",4096,NOW-10*60000);File oldEmpty=file(pictures,"JPEG_20261102_090001_12.jpg",0,NOW-10*60000);
File img=file(pictures,"IMG_1.jpg",4096,NOW-10*60000);
Files.createSymbolicLink(new File(pictures,"JPEG_20261102_090002_13.jpg").toPath(),outsideTarget.toPath());
CaptureCleanupPlugin p=new CaptureCleanupPlugin();p.load();
File afterLoad=file(pictures,"JPEG_20261103_101010_14.jpg",0,0);
check(!oldShared.exists()&&!new File(queue,hash).exists(),"old shared copy and its folder removed at load");
check(recentShared.exists(),"recent shared copy kept for its receiver");
check(oldOther.exists()&&!oldShared3.exists()&&new File(queue,hash3).isDirectory(),"only shared photos removed");
check(notHash.exists()&&loose.exists()&&apk.exists()&&outsideTarget.exists(),"other cache files kept");
joinWorker();
check(!oldCapture.exists()&&!oldEmpty.exists(),"old captures removed at load");
check(afterLoad.exists()&&img.exists()&&outsideTarget.exists(),"capture created after load and other files kept");
Context.broken=true;new CaptureCleanupPlugin().load();joinWorker();Context.broken=false;
Context.pictures=null;Context.cache=null;new CaptureCleanupPlugin().load();joinWorker();
check(afterLoad.exists()&&recentShared.exists()&&img.exists(),"no dirs ➜ nothing touched");
System.out.print("PASS capture cleanup");return;}
}}
`
};

it.each(['release', 'load'])('Java ពិត %s ៖ លុបតែរូបបណ្ដោះអាសន្នរបស់កាមេរ៉ា និងច្បាប់ចម្លងចែករំលែកចាស់ មិនលុបឯកសារផ្សេង', async (scenario) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-capture-java-'));
    const build = path.join(root, 'build');
    const data = path.join(root, 'data');
    try {
        for (const [file, source] of Object.entries(stubs)) {
            const target = path.join(build, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, source);
        }
        fs.mkdirSync(data);
        const plugin = path.join(JAVA_DIR, 'CaptureCleanupPlugin.java');
        execFileSync('java', ['--module', 'jdk.compiler/com.sun.tools.javac.Main', '-d', build, plugin, ...Object.keys(stubs).map((p) => path.join(build, p))], { timeout: 30000 });
        expect(execFileSync('java', ['-cp', build, 'com.zoesystem.zoew.Probe', scenario, data], { timeout: 20000, encoding: 'utf8' })).toBe('PASS capture cleanup');
        const main = fs.readFileSync(path.join(JAVA_DIR, 'MainActivity.java'), 'utf8');
        expect(main.indexOf('registerPlugin(CaptureCleanupPlugin.class);')).toBeGreaterThan(-1);
        expect(main.indexOf('registerPlugin(CaptureCleanupPlugin.class);')).toBeLessThan(main.indexOf('super.onCreate(savedInstanceState);'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
}, 60000);
