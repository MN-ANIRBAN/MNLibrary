import sys

with open('MainApp.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Find the new wrappers
idx_start = -1
for i, line in enumerate(lines):
    if "<div style={{ position: 'relative', flex: 1, display: 'flex' }}>" in line:
        idx_start = i
        break

if idx_start == -1:
    print('Start wrapper not found.')
    sys.exit(1)

# 2. Reconstruct original open tag
original_open = '''            <div style={{
              backgroundColor: theme === 'light' ? '#f8f9fa' : 'var(--bg-primary, #EBEAE5)',
              borderRadius: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '4px 16px 4px 20px',
              flex: 1,
              gap: '12px',
              position: 'relative',
              zIndex: 1,
              overflow: 'visible',
              border: 'none',
              boxShadow: 'none',
              flexWrap: 'wrap'
            }}>
'''

# Find the end of the current open tag
idx_end_open = -1
for i in range(idx_start, len(lines)):
    if "flexWrap: 'nowrap', overflowX: 'auto', whiteSpace: 'nowrap'" in lines[i]:
        idx_end_open = i + 1
        break

if idx_end_open == -1:
    print('End of open tag not found.')
    sys.exit(1)

# 3. Find the AnimatePresence block
start_ap = -1
end_ap = -1
for i in range(idx_end_open, len(lines)):
    if '<AnimatePresence>' in lines[i]:
        start_ap = i
        break
for i in range(start_ap, len(lines)):
    if '</AnimatePresence>' in lines[i]:
        end_ap = i
        break

ap_lines = lines[start_ap:end_ap+1]

# 4. Find the target location to put AnimatePresence back
# It was right before the </div> that closes the Advance Search button wrapper.
# That button wrapper is inside the {!isBinTab && ( block for Advance Search.
# Let's find "Advance Search" button text.
target_idx = -1
for i in range(idx_end_open, start_ap):
    if 'Advance Search' in lines[i]:
        # find the </button> after this
        for j in range(i, start_ap):
            if '</button>' in lines[j]:
                target_idx = j + 1
                break
        break

if target_idx == -1:
    print('Target index for AnimatePresence not found.')
    sys.exit(1)

# Now we need to carefully assemble the new lines
new_lines = lines[:idx_start]
new_lines.append(original_open)
new_lines.extend(lines[idx_end_open:target_idx])
new_lines.extend(ap_lines)
new_lines.extend(lines[target_idx:start_ap-1]) # start_ap - 1 is because there's a </div> at start_ap - 1 that we need to remove!
# Wait, let's look at the lines around start_ap.
# 1650:               )}
# 1651:               </div>
# 1652:                   <AnimatePresence>
# So start_ap is 1652. The </div> is at 1651. We need to skip 1651.
# So we include up to start_ap - 1.

# Let's verify line start_ap - 1 is </div>
if '</div>' in lines[start_ap - 1]:
    pass
else:
    print('WARNING: start_ap - 1 is not </div>:', lines[start_ap - 1])

# What about the final </div> at 1775?
# Let's look at lines after end_ap
# 1774:                   </AnimatePresence>
# 1775:             </div>
# 1776:           </header>
# So we need to skip line 1775.
final_div_idx = end_ap + 1

if '</div>' in lines[final_div_idx]:
    new_lines.extend(lines[final_div_idx+1:])
else:
    print('WARNING: final_div is not </div>:', lines[final_div_idx])
    new_lines.extend(lines[final_div_idx:])

with open('MainApp.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('SUCCESS')
