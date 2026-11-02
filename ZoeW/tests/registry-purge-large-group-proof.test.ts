import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { boundedRegistryPurgeIntent, registryPurgeIntent, registryPurgeReceiptValid, registryPurgeBindingHash, registryPurgeBindingPreimage, REGISTRY_PURGE_MAX_BYTES } from '../src/domain/registry-purge-proof';
import { canonicalBarcodeRegistryKey } from '../src/domain/barcode-key';
const vectors: Array<{name:string;ops:any[];preimage:string;hash:string;rawOpsJson?:string}> = [
  {
    "name": "mixed-ascii-receipt-order",
    "ops": [
      {
        "k": "set",
        "p": [
          "zoew_recently_deleted_cod_dod",
          "source"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_trash_consumptions",
          "source"
        ],
        "v": {
          "v": 1,
          "sourceId": "source",
          "generation": 3,
          "kind": "purge",
          "actorUid": "purge-user",
          "scope": "shop",
          "deletedAt": 456,
          "rowBirth": 100
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "AA"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        ],
        "v": {
          "v": 2,
          "generation": 3,
          "id": "scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "kind": "scan",
          "actorUid": "scan-actor",
          "releasedBy": "purge-user",
          "scope": "shop",
          "code": "aa",
          "registryKey": "AA",
          "birth": 123,
          "trashId": "source",
          "slot": "0",
          "deletedAt": 456,
          "rowBirth": 100,
          "rowCount": 2
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "B%2F%5B%5D"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        ],
        "v": {
          "v": 2,
          "generation": 3,
          "id": "release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "kind": "legacy",
          "actorUid": "purge-user",
          "releasedBy": "purge-user",
          "scope": "shop",
          "code": "b/[]",
          "registryKey": "B%2F%5B%5D",
          "birth": 0,
          "trashId": "source",
          "slot": "1",
          "deletedAt": 456,
          "rowBirth": 100,
          "rowCount": 2
        }
      }
    ],
    "preimage": "[\"zoew-registry-purge-v1\",2,\"source\",3,\"purge-user\",\"shop\",456,100,2,[[\"release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"legacy\",\"purge-user\",\"b/[]\",\"B%2F%5B%5D\",0,\"1\"],[\"scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"scan\",\"scan-actor\",\"aa\",\"AA\",123,\"0\"]]]",
    "hash": "9b3a9965c4cc5fb2c5656d4284432f0384d4f351bed62c903b0f688fb80b4457"
  },
  {
    "name": "unicode-uppercase-astral-and-space",
    "ops": [
      {
        "k": "set",
        "p": [
          "zoew_recently_deleted_cod_dod",
          "source"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_trash_consumptions",
          "source"
        ],
        "v": {
          "v": 1,
          "sourceId": "source",
          "generation": 3,
          "kind": "purge",
          "actorUid": "user \"quote\" \\ tab\tline\n",
          "scope": "https://\u4f8b\u3048.test/\u5e97 \"Q\" \\ tab\tline\n",
          "deletedAt": 456,
          "rowBirth": 100
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "STRASSE\ud83d\ude00%2F\u00c9"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "release_cccccccccccccccccccccccccccccccc"
        ],
        "v": {
          "v": 2,
          "generation": 3,
          "id": "release_cccccccccccccccccccccccccccccccc",
          "kind": "legacy",
          "actorUid": "user \"quote\" \\ tab\tline\n",
          "releasedBy": "user \"quote\" \\ tab\tline\n",
          "scope": "https://\u4f8b\u3048.test/\u5e97 \"Q\" \\ tab\tline\n",
          "code": " stra\u00dfe\ud83d\ude00/\u00e9 ",
          "registryKey": "STRASSE\ud83d\ude00%2F\u00c9",
          "birth": 123,
          "trashId": "source",
          "slot": "0",
          "deletedAt": 456,
          "rowBirth": 100,
          "rowCount": 1
        }
      }
    ],
    "preimage": "[\"zoew-registry-purge-v1\",2,\"source\",3,\"user \\\"quote\\\" \\\\ tab\\tline\\n\",\"https://\u4f8b\u3048.test/\u5e97 \\\"Q\\\" \\\\ tab\\tline\\n\",456,100,1,[[\"release_cccccccccccccccccccccccccccccccc\",\"legacy\",\"user \\\"quote\\\" \\\\ tab\\tline\\n\",\" stra\u00dfe\ud83d\ude00/\u00e9 \",\"STRASSE\ud83d\ude00%2F\u00c9\",123,\"0\"]]]",
    "hash": "d742db7f178eb2b2180c5dc0a6be7af395c7e86ba1bf264483bb7cc5f71bebbf"
  },
  {
    "name": "unicode-I-and-max-safe-protocol-integer",
    "ops": [
      {
        "k": "set",
        "p": [
          "zoew_recently_deleted_cod_dod",
          "source"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_trash_consumptions",
          "source"
        ],
        "v": {
          "v": 1,
          "sourceId": "source",
          "generation": 9007199254740990,
          "kind": "purge",
          "actorUid": "purge-user",
          "scope": "shop",
          "deletedAt": 9007199254740990,
          "rowBirth": 9007199254740989
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "II\u0130SS%2E%25%24%5B%5D%2F"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "release_dddddddddddddddddddddddddddddddd"
        ],
        "v": {
          "v": 2,
          "generation": 9007199254740990,
          "id": "release_dddddddddddddddddddddddddddddddd",
          "kind": "legacy",
          "actorUid": "purge-user",
          "releasedBy": "purge-user",
          "scope": "shop",
          "code": "i\u0131\u0130\u00df.%$[]/",
          "registryKey": "II\u0130SS%2E%25%24%5B%5D%2F",
          "birth": 9007199254740990,
          "trashId": "source",
          "slot": "7",
          "deletedAt": 9007199254740990,
          "rowBirth": 9007199254740989,
          "rowCount": 1
        }
      }
    ],
    "preimage": "[\"zoew-registry-purge-v1\",2,\"source\",9007199254740990,\"purge-user\",\"shop\",9007199254740990,9007199254740989,1,[[\"release_dddddddddddddddddddddddddddddddd\",\"legacy\",\"purge-user\",\"i\u0131\u0130\u00df.%$[]/\",\"II\u0130SS%2E%25%24%5B%5D%2F\",9007199254740990,\"7\"]]]",
    "hash": "2d49e29071b02c670fc1486cfb3f07e065d8e3daa3324087ce9685caf07f0201"
  },
  {
    "name": "escaped-quote-backslash-control",
    "ops": [
      {
        "k": "set",
        "p": [
          "zoew_recently_deleted_cod_dod",
          "source"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_trash_consumptions",
          "source"
        ],
        "v": {
          "v": 1,
          "sourceId": "source",
          "generation": 3,
          "kind": "purge",
          "actorUid": "uid\\x",
          "scope": "s\"\t\n\\\ud83d\ude00",
          "deletedAt": 456,
          "rowBirth": 100
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "A\"%09B%0AC\\D"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        ],
        "v": {
          "v": 2,
          "generation": 3,
          "id": "release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "kind": "legacy",
          "actorUid": "uid\\x",
          "releasedBy": "uid\\x",
          "scope": "s\"\t\n\\\ud83d\ude00",
          "code": "a\"\tb\nc\\d",
          "registryKey": "A\"%09B%0AC\\D",
          "birth": 123,
          "trashId": "source",
          "slot": "0",
          "deletedAt": 456,
          "rowBirth": 100,
          "rowCount": 1
        }
      }
    ],
    "preimage": "[\"zoew-registry-purge-v1\",2,\"source\",3,\"uid\\\\x\",\"s\\\"\\t\\n\\\\\ud83d\ude00\",456,100,1,[[\"release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"legacy\",\"uid\\\\x\",\"a\\\"\\tb\\nc\\\\d\",\"A\\\"%09B%0AC\\\\D\",123,\"0\"]]]",
    "hash": "193e2bc583910e1cdcade321bd66bc11a832fe611b51e234073286224ba04cb4"
  },
  {
    "name": "json-number-normalization",
    "ops": [
      {
        "k": "set",
        "p": [
          "zoew_recently_deleted_cod_dod",
          "source"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_trash_consumptions",
          "source"
        ],
        "v": {
          "v": 1,
          "sourceId": "source",
          "generation": 1,
          "kind": "purge",
          "actorUid": "purge-user",
          "scope": "shop",
          "deletedAt": 1,
          "rowBirth": 0
        }
      },
      {
        "k": "set",
        "p": [
          "zoew_barcode_registry",
          "N"
        ],
        "v": null
      },
      {
        "k": "set",
        "p": [
          "zoew_registry_releases",
          "release_ffffffffffffffffffffffffffffffff"
        ],
        "v": {
          "v": 2,
          "generation": 1,
          "id": "release_ffffffffffffffffffffffffffffffff",
          "kind": "legacy",
          "actorUid": "purge-user",
          "releasedBy": "purge-user",
          "scope": "shop",
          "code": "N",
          "registryKey": "N",
          "birth": 1,
          "trashId": "source",
          "slot": "0",
          "deletedAt": 1,
          "rowBirth": 0,
          "rowCount": 1
        }
      }
    ],
    "preimage": "[\"zoew-registry-purge-v1\",2,\"source\",1,\"purge-user\",\"shop\",1,0,1,[[\"release_ffffffffffffffffffffffffffffffff\",\"legacy\",\"purge-user\",\"N\",\"N\",1,\"0\"]]]",
    "hash": "c943d281a1ceabfc71d253f6599211b3483a486edda1ffec52682c453485997a",
    "rawOpsJson": "[{\"k\":\"set\",\"p\":[\"zoew_recently_deleted_cod_dod\",\"source\"],\"v\":null},{\"k\":\"set\",\"p\":[\"zoew_trash_consumptions\",\"source\"],\"v\":{\"v\":1,\"sourceId\":\"source\",\"generation\":1.0,\"kind\":\"purge\",\"actorUid\":\"purge-user\",\"scope\":\"shop\",\"deletedAt\":1.0,\"rowBirth\":0.0}},{\"k\":\"set\",\"p\":[\"zoew_barcode_registry\",\"N\"],\"v\":null},{\"k\":\"set\",\"p\":[\"zoew_registry_releases\",\"release_ffffffffffffffffffffffffffffffff\"],\"v\":{\"v\":2,\"generation\":1.0,\"id\":\"release_ffffffffffffffffffffffffffffffff\",\"kind\":\"legacy\",\"actorUid\":\"purge-user\",\"releasedBy\":\"purge-user\",\"scope\":\"shop\",\"code\":\"N\",\"registryKey\":\"N\",\"birth\":1.0,\"trashId\":\"source\",\"slot\":\"0\",\"deletedAt\":1.0,\"rowBirth\":0.0,\"rowCount\":1}}]"
  }
];
function packet(count:number){const receipts=Array.from({length:count},(_,i)=>({v:2,generation:1,id:'release_'+i.toString(16).padStart(32,'0'),kind:'legacy',actorUid:'user',releasedBy:'user',scope:'shop',code:'CODE'+i,registryKey:'CODE'+i,birth:1,trashId:'source',slot:String(i),deletedAt:2,rowBirth:1,rowCount:count}));return[{k:'set',p:['zoew_recently_deleted_cod_dod','source'],v:null},{k:'set',p:['zoew_trash_consumptions','source'],v:{v:1,sourceId:'source',generation:1,kind:'purge',actorUid:'user',scope:'shop',deletedAt:2,rowBirth:1}},...receipts.flatMap(r=>[{k:'set',p:['zoew_barcode_registry',r.registryKey],v:null},{k:'set',p:['zoew_registry_releases',r.id],v:r}])];}
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));afterEach(()=>vi.unstubAllGlobals());
it.each(vectors)('F03 frozen binding vector $name',async v=>{const input=v.rawOpsJson?JSON.parse(v.rawOpsJson):v.ops;expect(boundedRegistryPurgeIntent(input)?.receipts.length).toBe(v.ops.filter(o=>o.p[0]==='zoew_registry_releases').length);expect(registryPurgeBindingPreimage(input)).toBe(v.preimage);expect(await registryPurgeBindingHash(input)).toBe(v.hash);});
it.each([249,250,251,1000])('F03 bounded proof ទទួល full %s members តែ generic500នៅដដែល',n=>{const ops=packet(n);expect(boundedRegistryPurgeIntent(ops)?.receipts).toHaveLength(n);expect(!!registryPurgeIntent(ops)).toBe(n<=249);});
it('F03 v1 contract មិនពង្រីកជាមួយ bounded v2',()=>{const v1=packet(1).filter(o=>o.p[0]!=='zoew_trash_consumptions');for(const o of v1)if(o.p[0]==='zoew_registry_releases'){o.v.v=1;delete o.v.generation;}expect(registryPurgeIntent(v1)).not.toBeNull();expect(boundedRegistryPurgeIntent(v1)).toBeNull();});
it('F03 ops និង object-property order មិនប្តូរ binding',async()=>{const original=packet(2),permuted=original.slice().reverse().map(o=>({...o,v:o.v&&typeof o.v==='object'?Object.fromEntries(Object.entries(o.v).reverse()):o.v}));expect(await registryPurgeBindingHash(permuted)).toBe(await registryPurgeBindingHash(original));});
it('F03 hash binds every scan actor និង slot',async()=>{const original=JSON.parse(JSON.stringify(vectors[0].ops)),changed=JSON.parse(JSON.stringify(original));const r=changed.find((o:any)=>o.p[0]==='zoew_registry_releases'&&o.v.kind==='scan');r.v.actorUid='other-scan-actor';expect(boundedRegistryPurgeIntent(changed)).not.toBeNull();expect(await registryPurgeBindingHash(changed)).not.toBe(await registryPurgeBindingHash(original));r.v.actorUid='scan-actor';r.v.slot='7';expect(await registryPurgeBindingHash(changed)).not.toBe(await registryPurgeBindingHash(original));});
it.each(['missing-pair','extra-path','duplicate','count','generation','scope','consumption','registry-null','extra-field'])('F03 incomplete/foreign %s rejected',kind=>{const ops:any[]=packet(2);if(kind==='missing-pair')ops.splice(2,2);if(kind==='extra-path')ops.push({k:'set',p:['zoew_settings','rate'],v:1});if(kind==='duplicate')ops.push(ops[2]);if(kind==='count')ops[3].v.rowCount=1;if(kind==='generation')ops[3].v.generation=2;if(kind==='scope')ops[3].v.scope='other';if(kind==='consumption')ops[1].v.actorUid='other';if(kind==='registry-null')ops[2].v=true;if(kind==='extra-field')ops[3].v.extra=true;expect(boundedRegistryPurgeIntent(ops)).toBeNull();expect(registryPurgeBindingPreimage(ops)).toBeNull();});
it.each(['\u0000','\ud800','\udc00'])('F03 new protocol rejects NUL/lone surrogate %s while legacy parser unchanged',bad=>{const ops:any[]=packet(1);ops[3].v.code='A'+bad;ops[3].v.registryKey=canonicalBarcodeRegistryKey(ops[3].v.code);ops[2].p[1]=ops[3].v.registryKey;expect(registryPurgeIntent(ops)).not.toBeNull();expect(boundedRegistryPurgeIntent(ops)).toBeNull();});
it.each([undefined,null,NaN,{},[],[null]])('F03 malformed input %s fails closed',async input=>{expect(boundedRegistryPurgeIntent(input)).toBeNull();expect(registryPurgeBindingPreimage(input)).toBeNull();expect(await registryPurgeBindingHash(input)).toBeNull();});
it('F03 byte ceiling rejects individually valid full membership without silent truncation',()=>{const ops=packet(12000);expect(ops.filter(o=>o.p[0]==='zoew_registry_releases').every(o=>registryPurgeReceiptValid(o.v))).toBe(true);expect(new TextEncoder().encode(JSON.stringify(ops)).byteLength).toBeGreaterThan(REGISTRY_PURGE_MAX_BYTES);expect(boundedRegistryPurgeIntent(ops)).toBeNull();});

it('F03 Unicode canonical-key collision remains rejected and original code case remains hash-bound',async()=>{
 const original:any[]=packet(1);original[3].v.code='straße';original[3].v.registryKey='STRASSE';original[2].p[1]='STRASSE';
 const other=JSON.parse(JSON.stringify(original));other[3].v.code='STRASSE';expect(boundedRegistryPurgeIntent(original)).not.toBeNull();expect(boundedRegistryPurgeIntent(other)).not.toBeNull();expect(await registryPurgeBindingHash(original)).not.toBe(await registryPurgeBindingHash(other));
 const duplicate:any[]=packet(2);duplicate[3].v.code='straße';duplicate[3].v.registryKey='STRASSE';duplicate[2].p[1]='STRASSE';duplicate[5].v.code='STRASSE';duplicate[5].v.registryKey='STRASSE';duplicate[4].p[1]='STRASSE';expect(boundedRegistryPurgeIntent(duplicate)).toBeNull();
});
