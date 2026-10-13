#include "../bridge/daytona_link.h"
#include <cassert>
#include <iostream>
int main() {
 BrowserLink link;
 uint8_t packet[4096] = {1,2,3}, received[4096] = {};
 assert(link.read(received,3)==-1);
 link.reset(true);assert(link.receive(packet,3));assert(link.read(received,2)==2);assert(received[0]==1&&received[1]==2);assert(link.read(received,3)==1&&received[0]==3);assert(link.read(received,3)==0);
 assert(link.write(packet,3));assert(link.write(packet+1,2));assert(link.outgoing.front().size()==3);link.pop();assert(link.outgoing.front()[0]==2);link.pop();assert(link.queued==0);
 for(int i=0;i<256;i++)assert(link.write(packet,4096));assert(!link.write(packet,1));assert(!link.connected);
 link.reset(true);for(int i=0;i<256;i++)assert(link.receive(packet,4096));assert(!link.receive(packet,1));assert(!link.connected);
 link.reset(true);assert(!link.receive(packet,4097));link.reset(true);assert(!link.receive(packet,-1));
 std::cout << "PASS: original packet order, partial receive and bounded queues\n";
}
