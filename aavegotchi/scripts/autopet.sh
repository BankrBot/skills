#!/bin/bash
export PATH="$HOME/.foundry/bin:$PATH"
cd $HOME/.openclaw/skills/aavegotchi/scripts
# Use check-and-pet-auto.sh which reads gotchi IDs from config.json
./check-and-pet-auto.sh >> $HOME/.openclaw/logs/aavegotchi-autopet.log 2>&1
