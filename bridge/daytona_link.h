#pragma once
#include "runtime/comm_board.h"
#include <algorithm>
#include <deque>
#include <vector>

// Bounded byte stream on the receive side; preserve each original board write
// on the send side. The browser supplies reliable, ordered delivery.
class BrowserLink final : public rt::LinkTransport {
public:
    static constexpr size_t kLimit = 1024 * 1024;
    bool connected = false;
    std::deque<uint8_t> incoming;
    std::deque<std::vector<uint8_t>> outgoing;
    size_t queued = 0;
    void reset(bool open) { connected = open; incoming.clear(); outgoing.clear(); queued = 0; }
    void poll() override {}
    bool rx_open() const override { return connected; }
    bool tx_open() const override { return connected; }
    int read(uint8_t *buf, int max) override {
        if (!connected) return -1;
        int n = std::min<int>(max, incoming.size());
        for (int i = 0; i < n; ++i) { buf[i] = incoming.front(); incoming.pop_front(); }
        return n;
    }
    bool write(const uint8_t *buf, int n) override {
        if (!connected || n < 1 || n > 4096 || queued + n > kLimit) { connected = false; return false; }
        outgoing.emplace_back(buf, buf + n); queued += n; return true;
    }
    bool receive(const uint8_t *buf, int n) {
        if (!connected || n < 1 || n > 4096 || incoming.size() + n > kLimit) { connected = false; return false; }
        incoming.insert(incoming.end(), buf, buf + n); return true;
    }
    void pop() { if (!outgoing.empty()) { queued -= outgoing.front().size(); outgoing.pop_front(); } }
};
