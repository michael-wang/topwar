# P4.46 — Public Playtest GO / NO-GO

2026-10-20（Asia/Taipei）；驗證基準 `4baed45ca7d8257494b386b29a82cd936bba09df`。[工作單 #1](https://github.com/michael-wang/topwar/issues/1#issuecomment-6285578950)

**技術驗證 GO；公開發布暫為 NO-GO。** 未發現可重現的 Start、存檔、戰鬥完成、音訊或手機控制阻擋問題。Credits #15 已於 P4.48 實作、待 Owner Pixel 8 驗收；發布仍需取得其結論，並取得 #28 的 Owner 實機結論；不是要求再做美術或平衡迭代。

| Gate | 已檢查證據 | 結果 |
|---|---|---|
| Julia 正式修改／已驗收內容 | 開工 working tree 乾淨；Fetch 後本機與遠端均為 `4baed45`。開場框維持寬 6.2、Z45、深 4、高 2；rendering source、Tracer B、44.25 射程及 Gameplay 全部未改。Owner 已明確驗收窄框、B 與射程。 | PASS |
| Start／完整開場／Skip | 真正 `/topwar/` production build；350×844、390×844、safe-area、reduced motion、音訊拒絕／延遲、背景切換、Skip、Retry。窄框涵蓋三登陸線、不及側屋，第一句至最後一句固定；16 人與 T=0／其後 120 ticks 一致。`opening-prototype.mjs`：18 組。 | PASS |
| Stage 1 戰鬥與結果 | `ShorelineRange` 的真實 16 人前 60 秒及完整 6500 HP BOSS 通關；`ManualAirSupport` 的不呼叫、單次呼叫、勝利及持久化；正式共享驅逐艦、BOSS、空襲、勝利入口及回到一般遊戲。補查正式 GIANT 生成／通訊／紅框、Defeat→再試一次。採自然早期進程＋加速／共享場景，非人工從頭到尾實機通關。 | PASS |
| Continue／Retry／生命週期 | `production-resume.mjs`：兩種寬度皆通過新 16 人存檔的原生 Pause→reload→Continue、相同後續狀態與 Retry；`opening-prototype.mjs` 保留歷史 120 人、80 射程存檔，Retry 才採目前設定。完整回歸另含 released checkpoints、單次通訊與背景恢復。 | PASS |
| 正式資產／HUD／DEV 隔離 | `production-sanity.mjs`：12 組、零 JS errors；四個共享入口、支援按鈕預告／解鎖／一次呼叫、BOSS 警告、勝利音樂／結果。8 項直接 HTTP/內容比對涵蓋兩肖像、兩字型、正式開場／GIANT 語音、BOSS／勝利音樂。無 DEV 實驗控制。 | PASS |
| 基本工程品質 | Typecheck、Build、186 檔／1,483 項測試通過。只補強兩個既有 QA 工具；無需產品修正。忽略目錄 `artifacts/p4.46/` 保存執行結果。 | PASS |
| Credits #15 | P4.48 已使用 Owner 核准的完整名稱，從待機角落開啟／返回，獨立播放既有勝利音樂。待 Owner Pixel 8 排版／音樂驗收；勝利入口本輪未做。 | NEEDS OWNER PHONE |
| Pixel 8 組合操作 #28 | 單次 Start 的音訊＋可選 fullscreen、Continue 後首次 Resume、Android 系統退出後觸控／safe-area、背景返回，仍須 [Owner 實機步驟](FULLSCREEN_TRIAL.md#combined-startup--physical-pixel-8-acceptance)。桌面／模擬測試不等於 Android PASS。 | NEEDS OWNER PHONE |
| 可延後工作 | Lv1–3 低壓已暫時接受；GIANT smoke、Hybrid D、敗北／勝利美術與其他未阻擋可玩性的 polish。JS 約 1,147.97 kB／gzip 317.11 kB，CSS 40.13 kB／gzip 9.19 kB；Zod annotation 與 >500 kB chunk 警告為非阻擋。長時間熱度／幀率需實機觀察，有問題再定位；不據桌面結果重構或減少 VFX。 | DEFERRED |

## 接下來最值得做的三件事

1. **Owner 在 Pixel 8 驗收 P4.48 Credits #15** 的排版、音樂及返回待機；名稱已核准並實作。
2. **Owner 完成 Pixel 8 #28 組合操作驗收**，同一輪順便觀察一段後期遊戲的熱度／操作；只回報可重現的可玩性問題，不重開已 PASS 美術。
3. 前兩項完成且無新 blocker 後，**Owner 決定並手動發布指定 SHA**，再於實際 Pages HTTPS 做一次 Start／Continue／音訊與資產 smoke；本輪不部署。

凍結 tag `playtest-2026-10-08` 維持 `59136b49e1328ab754412f7affe90c755c76c0fd`。現有 Pages workflow 僅 `workflow_dispatch`；本輪未觸發。測試結果是本機 production build 證據，不是已發布網站或新一次 Pixel 8 驗收。
