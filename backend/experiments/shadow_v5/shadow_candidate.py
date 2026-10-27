"""Experimental peripheral chroma/edge evidence. Never imported by production."""
import cv2
import numpy as np

def correct_shadow(image, mask):
    corrected=mask.copy()
    lab=cv2.cvtColor(cv2.GaussianBlur(image,(5,5),0),cv2.COLOR_BGR2LAB).astype(float)
    ys,xs=np.nonzero(mask)
    if not len(ys): return corrected,{"reason":"empty mask"}
    ymin,ymax=int(ys.min()),int(ys.max())
    # Examine all rows, but require evidence throughout the measurement band.
    proposals={"left":[],"right":[]}
    for y in range(ymin,ymax+1):
        x=np.flatnonzero(mask[y])
        if len(x)<20:continue
        left,right=int(x[0]),int(x[-1]);width=right-left+1
        strip=max(3,round(width*.025))
        core=np.median(lab[y,left+int(.35*width):left+int(.65*width),1:],axis=0)
        for side in ("left","right"):
            bg_range=(max(0,left-4*strip),max(0,left-strip)) if side=="left" else (min(mask.shape[1],right+strip),min(mask.shape[1],right+4*strip))
            if bg_range[1]-bg_range[0]<strip:continue
            bg=np.median(lab[y,bg_range[0]:bg_range[1],1:],axis=0)
            if np.linalg.norm(core-bg)<10:continue # abstain on ambiguous chroma
            start,end=(left+strip,left+int(.30*width)) if side=="left" else (right-int(.30*width),right-strip)
            candidates=[]
            for boundary in range(start,end+1):
                inner=lab[y,boundary:boundary+strip,1:] if side=="left" else lab[y,boundary-strip+1:boundary+1,1:]
                outer=lab[y,left:boundary,1:] if side=="left" else lab[y,boundary+1:right+1,1:]
                if not len(inner) or len(outer)<strip:continue
                ci=np.median(inner,axis=0);co=np.median(outer,axis=0)
                # Outer strip must resemble neighboring background chroma more than cinnamon.
                if np.linalg.norm(co-bg)>6 or np.linalg.norm(co-bg)>=.5*np.linalg.norm(co-core):continue
                # A chromatic edge must separate cinnamon-like interior from background-like exterior.
                local_outer=outer[-strip:] if side=="left" else outer[:strip]
                edge=np.linalg.norm(ci-np.median(local_outer,axis=0))
                if edge<5 or np.linalg.norm(ci-core)>=np.linalg.norm(ci-bg):continue
                candidates.append((edge,boundary))
            if not candidates:continue
            candidates.sort(reverse=True)
            best=candidates[0]
            # Competing similarly strong edges far apart are ambiguous.
            if any(score>.9*best[0] and abs(b-best[1])>2*strip for score,b in candidates[1:]):continue
            shift=(best[1]-left) if side=="left" else (right-best[1])
            proposals[side].append((y,best[1],shift/width))
    band=(int(ymin+.3*(ymax-ymin)),int(ymin+.7*(ymax-ymin)))
    debug={"method":"peripheral_background_chroma_plus_local_edge","band":band,"sides":{}}
    for side,points in proposals.items():
        central=[p for p in points if band[0]<=p[0]<band[1]]
        support=len(central)/max(1,band[1]-band[0])
        shifts=np.array([p[2] for p in central])
        coherent=bool(len(shifts) and np.median(np.abs(shifts-np.median(shifts)))<=.035)
        enabled=support>=.6 and coherent
        debug["sides"][side]={"supported_fraction":support,"coherent":coherent,"applied":enabled,"rows":points}
        if enabled:
            for y,b,_ in points:
                if side=="left":corrected[y,:b]=0
                else:corrected[y,b+1:]=0
    return corrected,debug
