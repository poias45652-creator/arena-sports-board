"""Log only a provider's recognized failure signals. Never emit raw page text or URLs."""
import hashlib
import json
import re
from html.parser import HTMLParser

FIELDS = {"username","account","password","device_id","captcha","game_return_url","game_device","game_kind","game_money","token"}
WORDS = set("""access denied forbidden unauthorized authorization permission blocked blocking block restricted unavailable not available in this your country region area ip address origin domain referer referrer invalid signature token expired request could satisfy satisfied cloudfront cloudflare nginx openresty aws waf error code login username user account password credentials or incorrect wrong does did match our records validation failed field required selected has been cannot be found exists valid is are must the and from visitor to this site website sorry you have blocked enabled disabled too many requests service temporarily verification authenticate geo geoip prohibited network distribution configured allow operation player member maintenance game platform desktop mobile route endpoint using data provided unprocessable entity action authenticated credential resource accountname authentication unsuccessful missing real client public key denied rejected legal reasons suspended locked verify human checking browser security please enable cookies support hostname administrator country banned validate mismatch unsuccessful restricted geographic region territory allowed location credentials remember attempts attempts exceeded login name authenticating account unavailable temporarily blacklisted disabled failed wrong details firewall proxy vpn automatic traffic attention required""".split())
ZH_TERMS = ("帳號或密碼錯誤","账号或密码错误","帳號或密碼不正確","账号或密码不正确","密碼錯誤","密码错误","密碼不正確","密码不正确","查無此帳號","查无此账号","用户不存在","用戶不存在","帳號不存在","账号不存在","未開通","未开通","帳號已停用","账号已停用","帳戶已鎖定","验证失败","驗證失敗","帳號異常","账号异常","資料錯誤","参数错误","必填","地區限制","地区限制","訪問被拒絕","访问被拒绝","拒絕存取","無權限","无权限","會員","会员","用戶","用户","帳號","账号","密碼","密码","不存在","錯誤","错误","禁止","驗證碼","验证码","無效","无效","已被鎖定","已被锁定","不正確","不正确","登錄失敗","登入失敗","登录失败","帳號已被鎖定","帳戶已被鎖定","账号已被锁定","禁止登入","禁止登录","請稍後再試","请稍后再试","登入次數","登录次数","凭证","憑證","限制","頻繁","频繁","停用","冻结","凍結","查無","查无","未啟用","未启用","不匹配","不符","使用者名稱","用户名","密碼有誤","密码有误","遊戲維護","游戏维护","場館維護","场馆维护","授權","授权")
class Visible(HTMLParser):
    hidden=0
    def __init__(self):
        super().__init__()
        self.chunks=[]
    def handle_starttag(self, tag, attrs):
        if tag in {"script","style","template","noscript"}: self.hidden+=1
    def handle_endtag(self, tag):
        if tag in {"script","style","template","noscript"}: self.hidden=max(0,self.hidden-1)
    def handle_data(self,data):
        if not self.hidden: self.chunks.append(data)

def visible_words(value):
    words=re.findall(r"[a-z]+|[\u3400-\u9fff]+",value.lower())
    safe=[]
    for word in words:
        if word in WORDS: safe.append(word)
        elif any('\u3400'<=c<='\u9fff' for c in word):
            safe.extend(t for t in ZH_TERMS if t in word)
    return " ".join(safe[:40])

def signals(body,headers):
    mime=headers.get("content-type","").split(";")[0].lower()
    mime=mime if mime in {"text/html","application/json","text/plain","application/xml","text/xml"} else "other"
    result={"mime":mime,"bytes_read":None if body is None else len(body),"challenge":headers.get("cf-mitigated","").lower()=="challenge"}
    for header in ("server","via","x-cache"):
        value=headers.get(header,"").lower()
        matched=[label for label in ("cloudflare","cloudfront","nginx","openresty","amazon","akamai","varnish","envoy","cache","hit","miss","error") if label in value]
        if matched: result[header]=matched
    if headers.get("content-length","").isdigit(): result["declared_bytes"]=int(headers["content-length"])
    if body is None:return result
    decoded=body[:98304].decode("utf8","replace")
    result["fingerprint"]=hashlib.sha256(body).hexdigest()[:16]
    doc=None
    try: doc=json.loads(decoded)
    except (ValueError,RecursionError): pass
    if isinstance(doc,dict):
        code=doc.get("code")
        if re.fullmatch(r"-?[0-9]{1,6}",str(code)):result["service_code"]=str(code)
        errors=doc.get("errors")
        texts=[doc.get("message"),doc.get("msg"),doc.get("error_description"),doc.get("error")]
        if isinstance(errors,dict):
            result["fields"]=[k for k in errors if k in FIELDS]
            for k in result["fields"]:
                value=errors[k]
                texts.extend(value if isinstance(value,list) else [value])
        visible=" ".join(x for x in texts if isinstance(x,str))
    else:
        parser=Visible()
        try: parser.feed(decoded)
        except ValueError: pass
        visible=" ".join(parser.chunks)
    result["words"]=visible_words(visible)
    m=re.search(r"(?:error(?:\s+code)?\s*[:#]?\s*|cf-error-code[^>]*>\s*)(1[0-9]{3})\b",visible+" "+decoded[:12000],re.I)
    if m:result["edge_error"]=m[1]
    return result
