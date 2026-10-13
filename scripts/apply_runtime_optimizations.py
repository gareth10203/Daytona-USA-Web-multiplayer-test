#!/usr/bin/env python3
"""Apply bounded callback storage and avoid unused link deadlines in the web port."""
from pathlib import Path
import sys
repo=Path(sys.argv[1])
for name in ('lockstep.h','lockstep.cpp'):
 p=repo/'src/runtime'/name;s=p.read_text(encoding='utf-8')
 if '|| defined(M2_WEBGPU)' not in s:s=s.replace('defined(M2_DC_MEMORY) || defined(M2_FAST_GEN)', 'defined(M2_DC_MEMORY) || defined(M2_FAST_GEN) || defined(M2_WEBGPU)')
 if name=='lockstep.h' and 'callback_slots()' not in s:
  s=s.replace('int interrupts() const { return taken_; }','int interrupts() const { return taken_; }\n    size_t callback_slots() const { return calls_.size(); }')
 if s!=p.read_text(encoding='utf-8'):p.write_text(s,encoding='utf-8')
p=repo/'src/runtime/game_loop.h';s=p.read_text(encoding='utf-8')
if 'callback_slots()' not in s:
 marker='    uint64_t instructions() const'
 pos=s.find(marker)
 if pos<0:raise SystemExit('Missing instructions accessor')
 s=s[:pos]+'    size_t callback_slots() const { return ls_->callback_slots(); }\n'+s[pos:]
if s!=p.read_text(encoding='utf-8'):p.write_text(s,encoding='utf-8')
p=repo/'src/runtime/comm_board.cpp';s=p.read_text(encoding='utf-8')
old='const auto deadline = std::chrono::steady_clock::now() + kSyncTimeout;'
new='// With frame sync disabled the deadline is never used. In WebAssembly\n        // a clock read crosses into JS, and fg_r is polled thousands of times.\n        const auto deadline = framesync_ == 0\n            ? std::chrono::steady_clock::time_point::max()\n            : std::chrono::steady_clock::now() + kSyncTimeout;'
if old in s:s=s.replace(old,new)
elif 'const auto deadline = framesync_ == 0' not in s:raise SystemExit('Missing comm deadline')
if s!=p.read_text(encoding='utf-8'):p.write_text(s,encoding='utf-8')
