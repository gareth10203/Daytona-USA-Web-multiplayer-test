#include "../bridge/daytona_link.h"
#include <array>
#include <cassert>
#include <iostream>
#include <memory>
int main() {
 for(int count : {2,4,8}) {
  std::array<BrowserLink,8> links;
  std::vector<std::array<uint8_t,0x4000>> ram(count);
  std::array<std::unique_ptr<rt::CommBoard>,8> boards;
  for(int i=0;i<count;i++) {
   links[i].reset(true);boards[i]=std::make_unique<rt::CommBoard>(ram[i].data());
   boards[i]->set_transport(&links[i]);boards[i]->fg_w(i==0?1:0);boards[i]->cn_w(1);
  }
  auto route=[&]{for(int i=0;i<count;i++)while(!links[i].outgoing.empty()){
   auto &p=links[i].outgoing.front();assert(links[(i+1)%count].receive(p.data(),p.size()));links[i].pop();
  }};
  for(int frame=0;frame<500;frame++){for(int i=0;i<count;i++)boards[i]->vblank();route();}
  std::array<bool,9> assigned{};
  for(int i=0;i<count;i++){assert(boards[i]->link()==rt::CommBoard::Link::Up);assert(boards[i]->count()==count);assert(boards[i]->id()>=1&&boards[i]->id()<=count);assert(!assigned[boards[i]->id()]);assigned[boards[i]->id()]=true;ram[i][0x2000]=uint8_t(i+20);}
  assert(boards[0]->id()==1);
  for(int frame=0;frame<50;frame++){for(int i=0;i<count;i++){boards[i]->vblank();boards[i]->fg_r();}route();}
  for(int i=0;i<count;i++)assert(ram[i][0x21c0]>=20&&ram[i][0x21c0]<20+count);
  links[0].connected=false;boards[0]->vblank();assert(boards[0]->link()==rt::CommBoard::Link::Lost);
  std::cout<<"PASS: "<<count<<" original communication boards enumerate and exchange data\n";
 }
}
