import sys

with open('MainApp.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find opening of flex container
idx1 = -1
for i, line in enumerate(lines):
    if 'backgroundColor: theme === \'light\' ? \'#f8f9fa\' : \'var(--bg-primary, #EBEAE5)\',' in line and 'borderRadius: \'32px\',' in lines[i+1]:
        idx1 = i - 1
        break

if idx1 != -1:
    lines[idx1] = '            <div style={{ position: \'relative\', flex: 1, display: \'flex\' }}>\n              <div className=\"hide-scrollbar\" style={{\n'
    # replace flexWrap
    for i in range(idx1, idx1+20):
        if 'flexWrap: \'wrap\'' in lines[i]:
            lines[i] = lines[i].replace('flexWrap: \'wrap\'', 'flexWrap: \'nowrap\', overflowX: \'auto\', whiteSpace: \'nowrap\'')
            
    # extract animate presence
    start_ap = -1
    end_ap = -1
    for i in range(idx1, len(lines)):
        if '<AnimatePresence>' in lines[i]:
            start_ap = i
            break
            
    for i in range(start_ap, len(lines)):
        if '</AnimatePresence>' in lines[i]:
            end_ap = i
            break
            
    ap_lines = lines[start_ap:end_ap+1]
    
    # remove ap_lines from original position
    del lines[start_ap:end_ap+1]
    
    # find closing of flex container. It should be right before </header>
    close_idx = -1
    for i in range(start_ap, len(lines)):
        if '</header>' in lines[i]:
            close_idx = i - 2
            break
            
    if close_idx != -1:
        # insert ap_lines right before the closing div
        lines.insert(close_idx + 1, '              </div>\n') # close hide-scrollbar div
        for j, apl in enumerate(ap_lines):
            lines.insert(close_idx + 2 + j, apl)
        lines.insert(close_idx + 2 + len(ap_lines), '            </div>\n') # close relative wrapper
        
        # We need to remove the closing div of the original container.
        # It was originally right before </header> as             </div>
        # wait, the original structure:
        #           <header>
        #             <div> (the one we replaced with two divs)
        #             </div>
        #           </header>
        # So close_idx points to             </div> which is the close of the original div.
        # But we already added the closing of the new inner div and outer div.
        # Actually, let's just find             </div> right before </header> and replace it with               </div>\n + ap_lines +             </div>\n.
        
        with open('MainApp.jsx', 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print('SUCCESS1')
    else:
        print('FAILED to find closing header')
else:
    print('FAILED to find container')
