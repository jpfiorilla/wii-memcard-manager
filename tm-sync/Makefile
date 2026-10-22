#---------------------------------------------------------------------------------
# TM Sync — Wii homebrew (devkitPPC + libogc + libfat)
#   make            -> tm-sync.dol (copy to sd:/apps/tm-sync/boot.dol)
#   make package    -> dist/apps/tm-sync/{boot.dol,meta.xml,config.ini}
#---------------------------------------------------------------------------------
.SUFFIXES:

ifeq ($(strip $(DEVKITPPC)),)
$(error "Please set DEVKITPPC in your environment. export DEVKITPPC=<path to>devkitPPC")
endif

include $(DEVKITPPC)/wii_rules

TARGET   := tm-sync
BUILD    := build
SOURCES  := source
INCLUDES := source

# We link high in MEM1 so we can copy Slippi Nintendont's loader (0x80004000+) into
# place underneath ourselves before jumping to it. Keep both values in sync.
LOAD_ADDR := 0x81200000

CFLAGS   = -g -O2 -Wall -Wextra -Wno-unused-parameter $(MACHDEP) $(INCLUDE) -DTMSYNC_LOAD_ADDR=$(LOAD_ADDR)u
CXXFLAGS = $(CFLAGS)
LDFLAGS  = -g $(MACHDEP) -Wl,-Map,$(notdir $@).map -Wl,--section-start,.init=$(LOAD_ADDR)

LIBS    := -lwiiuse -lbte -lfat -logc -lm
LIBDIRS := $(PORTLIBS) $(LIBOGC_LIB)/..

#---------------------------------------------------------------------------------
ifneq ($(BUILD),$(notdir $(CURDIR)))
#---------------------------------------------------------------------------------

export OUTPUT  := $(CURDIR)/$(TARGET)
export VPATH   := $(foreach dir,$(SOURCES),$(CURDIR)/$(dir))
export DEPSDIR := $(CURDIR)/$(BUILD)

CFILES   := $(foreach dir,$(SOURCES),$(notdir $(wildcard $(dir)/*.c)))
export LD := $(CC)
export OFILES   := $(CFILES:.c=.o)
export INCLUDE  := $(foreach dir,$(INCLUDES),-iquote $(CURDIR)/$(dir)) \
                   $(foreach dir,$(LIBDIRS),-I$(dir)/include) \
                   -I$(CURDIR)/$(BUILD) -I$(LIBOGC_INC)
export LIBPATHS := -L$(LIBOGC_LIB) $(foreach dir,$(LIBDIRS),-L$(dir)/lib)

.PHONY: $(BUILD) clean package

$(BUILD):
	@[ -d $@ ] || mkdir -p $@
	@$(MAKE) --no-print-directory -C $(BUILD) -f $(CURDIR)/Makefile

clean:
	@echo clean ...
	@rm -fr $(BUILD) $(OUTPUT).elf $(OUTPUT).dol dist

package: $(BUILD)
	@mkdir -p dist/apps/tm-sync
	@cp $(OUTPUT).dol dist/apps/tm-sync/boot.dol
	@cp meta.xml config.ini icon.png dist/apps/tm-sync/
	@echo packaged dist/apps/tm-sync

#---------------------------------------------------------------------------------
else

DEPENDS := $(OFILES:.o=.d)

$(OUTPUT).dol: $(OUTPUT).elf
$(OUTPUT).elf: $(OFILES)

-include $(DEPENDS)

#---------------------------------------------------------------------------------
endif
#---------------------------------------------------------------------------------
